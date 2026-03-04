<?php
declare(strict_types=1);

final class QuizService
{
    /**
     * @param array<string, float|int> $scores
     * @return array<string, float>
     */
    public function normalizeScores(array $scores): array
    {
        $normalized = ['EI' => 0.0, 'SN' => 0.0, 'TF' => 0.0, 'JP' => 0.0];

        foreach ($normalized as $dimension => $default) {
            if (array_key_exists($dimension, $scores)) {
                $normalized[$dimension] = (float) $scores[$dimension];
            }
        }

        return $normalized;
    }

    public function isComplete(int $answeredCount, int $totalQuestions): bool
    {
        if ($totalQuestions <= 0) {
            return true;
        }

        return $answeredCount >= $totalQuestions;
    }

    /**
     * @param array<string, float|int> $scores
     */
    public function deriveType(array $scores): string
    {
        $normalized = $this->normalizeScores($scores);

        return
            ($normalized['EI'] >= 0 ? 'E' : 'I') .
            ($normalized['SN'] >= 0 ? 'S' : 'N') .
            ($normalized['TF'] >= 0 ? 'T' : 'F') .
            ($normalized['JP'] >= 0 ? 'J' : 'P');
    }
}
