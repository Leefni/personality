<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../db.php';

$visitor = $_COOKIE['visitor_id'] ?? '';
if ($visitor === '') {
    echo json_encode([]);
    exit;
}

$stmt = $pdo->prepare('SELECT question_id, value FROM answers WHERE visitor_id = ?');
$stmt->execute([$visitor]);

echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
