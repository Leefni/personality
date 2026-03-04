<?php
declare(strict_types=1);

require __DIR__ . '/../src/QuizService.php';

function assert_same(mixed $actual, mixed $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ' Expected: ' . var_export($expected, true) . ', got: ' . var_export($actual, true));
    }
}

$service = new QuizService();

assert_same($service->isComplete(10, 10), true, 'Exact completion should pass.');
assert_same($service->isComplete(11, 10), true, 'Over-completion should pass.');
assert_same($service->isComplete(9, 10), false, 'Incomplete answers should fail.');
assert_same($service->isComplete(0, 0), true, 'Zero-question quiz should be complete.');

assert_same($service->deriveType(['EI' => 1, 'SN' => -1, 'TF' => 0, 'JP' => -0.5]), 'ENTP', 'Type derivation with mixed signs.');
assert_same($service->deriveType(['EI' => -0.1, 'SN' => 0.2, 'TF' => -5, 'JP' => 9]), 'ISFJ', 'Type derivation with negative/positive values.');
assert_same($service->deriveType([]), 'ESTJ', 'Missing dimensions should default to zero (positive side).');

echo "QuizService unit tests passed.\n";
