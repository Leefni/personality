<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

$visitor = get_visitor_id();
if ($visitor === '') {
    json_success([]);
}

$stmt = $pdo->prepare('SELECT question_id, value FROM answers WHERE visitor_id = ?');
$stmt->execute([$visitor]);

json_success($stmt->fetchAll());
