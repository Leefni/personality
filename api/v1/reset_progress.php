<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$visitor = get_visitor_id($payload);
if ($visitor === '') {
    json_success(['ok' => true]);
}

$deleteAnswers = $pdo->prepare('DELETE FROM answers WHERE visitor_id = ?');
$deleteAnswers->execute([$visitor]);

$deleteResults = $pdo->prepare('DELETE FROM results WHERE visitor_id = ?');
$deleteResults->execute([$visitor]);

clear_visitor_cache($visitor);

json_success(['ok' => true]);
