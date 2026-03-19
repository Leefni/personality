<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$visitor = get_visitor_id($payload);
if ($visitor === '') {
    json_success(['ok' => true]);
}

$quizRepository->clearProgress($visitor);
invalidate_cached_result($pdo, $visitor);

json_success(['ok' => true]);
