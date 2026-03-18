<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$visitor = get_visitor_id($payload);
if ($visitor === '') {
    json_error('No visitor session', 400);
}

$quizRepository->clearProgress($visitor);
$cache = read_results_cache();
unset($cache[$visitor]);
write_results_cache($cache);

json_success(['ok' => true]);
