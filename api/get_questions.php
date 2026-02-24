<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../db.php';

$stmt = $pdo->query('SELECT id, text, dimension, direction, weight FROM questions ORDER BY id');
echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
