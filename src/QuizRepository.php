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
             ON DUPLICATE KEY UPDATE value = VALUES(value)'
        );
        $stmt->execute([$questionId, $visitor, $value]);
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

    /** @return array<string, float> */
    public function getDimensionScores(string $visitor): array
    {
        $sums = ['EI' => 0.0, 'SN' => 0.0, 'TF' => 0.0, 'JP' => 0.0];

        $stmt = $this->pdo->prepare(
            'SELECT q.dimension, SUM((a.value - 3.5) * q.direction * q.weight) AS score
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
    public function saveResult(string $visitor, string $type, array $scores): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO results (visitor_id, type_code, detail_json)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE type_code = VALUES(type_code), detail_json = VALUES(detail_json)'
        );
        $stmt->execute([$visitor, $type, json_encode($scores)]);
    }

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
}
