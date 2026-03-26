<?php
declare(strict_types=1);

final class QuizRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return array<int, array<string, mixed>> */
    public function getVisitorAnswers(string $visitor): array
    {
        $stmt = $this->pdo->prepare('SELECT question_id, value FROM answers WHERE visitor_id = ?');
        $stmt->execute([$visitor]);

        return $stmt->fetchAll();
    }

    /** @return array{questions: array<int, array<string, mixed>>, total: int} */
    public function getQuestionsPage(int $perPage, int $offset): array
    {
        $total = (int) $this->pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn();

        $stmt = $this->pdo->prepare('SELECT id, text FROM questions ORDER BY id LIMIT :limit OFFSET :offset');
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'questions' => $stmt->fetchAll(),
            'total' => $total,
        ];
    }

    public function questionExists(int $questionId): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM questions WHERE id = ?');
        $stmt->execute([$questionId]);

        return $stmt->fetchColumn() !== false;
    }

    public function saveAnswer(int $questionId, string $visitor, int $value): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO answers (question_id, visitor_id, value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE value = ?'
        );
        $stmt->execute([$questionId, $visitor, $value, $value]);
    }

    public function clearProgress(string $visitor): void
    {
        $deleteAnswers = $this->pdo->prepare('DELETE FROM answers WHERE visitor_id = ?');
        $deleteAnswers->execute([$visitor]);

        $deleteResults = $this->pdo->prepare('DELETE FROM results WHERE visitor_id = ?');
        $deleteResults->execute([$visitor]);
    }

    public function getAnsweredQuestionCount(string $visitor): int
    {
        $stmt = $this->pdo->prepare('SELECT COUNT(DISTINCT question_id) FROM answers WHERE visitor_id = ?');
        $stmt->execute([$visitor]);

        return (int) $stmt->fetchColumn();
    }

    public function getTotalQuestionCount(): int
    {
        return (int) $this->pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn();
    }

    /**
     * Returns the theoretical maximum absolute score for each dimension.
     * Max = SUM(weight) * 2.5, where 2.5 is the max deviation on a 6-point
     * scale with midpoint 3.5 (i.e. 6 − 3.5).
     *
     * @return array<string, float>
     */
    public function getMaxTheoreticalScores(): array
    {
        $defaults = ['EI' => 0.0, 'SN' => 0.0, 'TF' => 0.0, 'JP' => 0.0];

        $stmt = $this->pdo->query(
            'SELECT dimension, SUM(weight) * 2.5 AS max_score FROM questions GROUP BY dimension'
        );

        foreach ($stmt as $row) {
            $dimension = (string) $row['dimension'];
            if (array_key_exists($dimension, $defaults)) {
                $defaults[$dimension] = (float) $row['max_score'];
            }
        }

        return $defaults;
    }

    /** @return array<string, float> */
    public function getDimensionScores(string $visitor): array
    {
        $sums = ['EI' => 0.0, 'SN' => 0.0, 'TF' => 0.0, 'JP' => 0.0];

        $likertMidpoint = 3.5; // Canonical 6-point scale midpoint between 3 and 4.

        $stmt = $this->pdo->prepare(
            'SELECT q.dimension, SUM((a.value - ' . $likertMidpoint . ') * q.direction * q.weight) AS score
             FROM answers a
             JOIN questions q ON a.question_id = q.id
             WHERE a.visitor_id = ?
             GROUP BY q.dimension'
        );
        $stmt->execute([$visitor]);

        foreach ($stmt as $row) {
            $dimension = (string) $row['dimension'];
            if (array_key_exists($dimension, $sums)) {
                $sums[$dimension] = (float) $row['score'];
            }
        }

        return $sums;
    }

    /** @param array<string, float> $scores */
    public function createRecoveryToken(
        string $tokenHash,
        string $visitorId,
        string $email,
        DateTimeImmutable $expiresAt,
        ?string $ipAddress
    ): void {
        $stmt = $this->pdo->prepare(
            'INSERT INTO recovery_tokens (token_hash, visitor_id, email, expires_at, requested_ip)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $tokenHash,
            $visitorId,
            mb_strtolower(trim($email)),
            $expiresAt->format('Y-m-d H:i:s'),
            $ipAddress,
        ]);
    }

    public function countRecoveryRequestsForVisitorSince(string $visitorId, DateTimeImmutable $since): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM recovery_audit_log
             WHERE event_type = 'recovery_request'
               AND status IN ('accepted', 'sent')
               AND visitor_id = ?
               AND created_at >= ?"
        );
        $stmt->execute([$visitorId, $since->format('Y-m-d H:i:s')]);

        return (int) $stmt->fetchColumn();
    }

    public function countRecoveryRequestsForEmailSince(string $email, DateTimeImmutable $since): int
    {
        $stmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM recovery_audit_log
             WHERE event_type = 'recovery_request'
               AND status IN ('accepted', 'sent')
               AND email = ?
               AND created_at >= ?"
        );
        $stmt->execute([mb_strtolower(trim($email)), $since->format('Y-m-d H:i:s')]);

        return (int) $stmt->fetchColumn();
    }

    public function writeRecoveryAudit(
        string $eventType,
        string $status,
        ?string $visitorId,
        ?string $email,
        ?string $ipAddress,
        array $details = []
    ): void {
        $encodedDetails = empty($details) ? null : json_encode($details, JSON_UNESCAPED_UNICODE);
        $stmt = $this->pdo->prepare(
            'INSERT INTO recovery_audit_log (event_type, status, visitor_id, email, ip_address, detail_json)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $eventType,
            $status,
            $visitorId,
            $email !== null ? mb_strtolower(trim($email)) : null,
            $ipAddress,
            $encodedDetails,
        ]);
    }

    /** @return array{id:int,visitor_id:string,email:string}|null */
    public function redeemRecoveryToken(string $tokenHash, ?string $ipAddress): ?array
    {
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) {
            $this->pdo->beginTransaction();
        }

        try {
            $stmt = $this->pdo->prepare(
                'SELECT id, visitor_id, email
                 FROM recovery_tokens
                 WHERE token_hash = ?
                   AND redeemed_at IS NULL
                   AND expires_at > UTC_TIMESTAMP()
                 LIMIT 1
                 FOR UPDATE'
            );
            $stmt->execute([$tokenHash]);
            $tokenRow = $stmt->fetch();

            if (!$tokenRow) {
                if ($ownsTransaction && $this->pdo->inTransaction()) {
                    $this->pdo->commit();
                }

                return null;
            }

            $update = $this->pdo->prepare(
                'UPDATE recovery_tokens
                 SET redeemed_at = UTC_TIMESTAMP(), redeemed_ip = ?
                 WHERE id = ?'
            );
            $update->execute([$ipAddress, (int) $tokenRow['id']]);

            if ($ownsTransaction && $this->pdo->inTransaction()) {
                $this->pdo->commit();
            }

            return [
                'id' => (int) $tokenRow['id'],
                'visitor_id' => (string) $tokenRow['visitor_id'],
                'email' => (string) $tokenRow['email'],
            ];
        } catch (Throwable $e) {
            if ($ownsTransaction && $this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw $e;
        }
    }

    /**
     * @return array<int, array{display_name:string,type_code:string,scores:array<string,mixed>,created_at:string}>
     */
    public function getPublicResults(int $limit = 30): array
    {
        $safeLimit = max(1, min(120, $limit));
        $stmt = $this->pdo->prepare(
            'SELECT id, visitor_id, display_name, type_code, detail_json, created_at
             FROM results
             WHERE is_public = 1
             ORDER BY created_at DESC
             LIMIT :limit'
        );
        $stmt->bindValue(':limit', $safeLimit, PDO::PARAM_INT);
        $stmt->execute();

        $rows = [];
        foreach ($stmt->fetchAll() as $row) {
            $rawDisplayName = isset($row['display_name']) ? trim((string) $row['display_name']) : '';
            $displayName = $rawDisplayName !== ''
                ? $rawDisplayName
                : self::buildAnonymousDisplayName((int) ($row['id'] ?? 0), (string) ($row['visitor_id'] ?? ''));

            $decodedScores = json_decode((string) ($row['detail_json'] ?? ''), true);
            $scores = is_array($decodedScores) ? $decodedScores : [];

            $rows[] = [
                'display_name' => $displayName,
                'type_code' => (string) ($row['type_code'] ?? ''),
                'scores' => $scores,
                'created_at' => (string) ($row['created_at'] ?? ''),
            ];
        }

        return $rows;
    }

    public function upsertResultShareMeta(string $visitorId, ?string $displayName, bool $isPublic = true): void
    {
        $name = trim((string) ($displayName ?? ''));
        $stmt = $this->pdo->prepare(
            'UPDATE results SET display_name = ?, is_public = ? WHERE visitor_id = ?'
        );
        $stmt->execute([
            $name !== '' ? mb_substr($name, 0, 80) : null,
            $isPublic ? 1 : 0,
            $visitorId,
        ]);
    }

    private static function buildAnonymousDisplayName(int $resultId, string $visitorId): string
    {
        $animals = ['Fox', 'Otter', 'Falcon', 'Sparrow', 'Panda', 'Dolphin', 'Owl', 'Koala'];
        $seed = $resultId > 0 ? $resultId : abs((int) crc32($visitorId));
        $animal = $animals[$seed % count($animals)];
        $suffix = str_pad((string) (($seed % 9000) + 1000), 4, '0', STR_PAD_LEFT);

        return sprintf('Anoniem %s %s', $animal, $suffix);
    }

}
