<?php
require '../db.php';
$data = json_decode(file_get_contents('php://input'), true);


$visitor = $_COOKIE['visitor_id'] ?? null;
if (!$visitor) {
$visitor = uuid_create(UUID_TYPE_RANDOM);
setcookie('visitor_id', $visitor, time()+31536000, '/');
}


$stmt = $pdo->prepare(
"INSERT INTO answers (question_id, visitor_id, value)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE value = VALUES(value)"
);
$stmt->execute([
$data['question_id'],
$visitor,
$data['value']
]);


echo json_encode(['ok'=>true]);