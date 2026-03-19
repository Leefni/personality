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
    public function saveResult(string $visitor, string $type, array $scores): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO results (visitor_id, type_code, detail_json)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE type_code = VALUES(type_code), detail_json = VALUES(detail_json)'
        );
        $stmt->execute([$visitor, $type, json_encode($scores)]);
    }
}
