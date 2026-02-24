<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
$questionId = isset($payload['question_id']) ? (int) $payload['question_id'] : 0;
$value = isset($payload['value']) ? (int) $payload['value'] : 0;

if ($questionId <= 0 || $value < 1 || $value > 5) {
    http_response_code(422);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$visitor = $_COOKIE['visitor_id'] ?? '';
if ($visitor === '') {
    $visitor = bin2hex(random_bytes(16));
    setcookie('visitor_id', $visitor, [
        'expires' => time() + 31536000,
        'path' => '/',
        'samesite' => 'Lax',
    ]);
}

$stmt = $pdo->prepare(
    'INSERT INTO answers (question_id, visitor_id, value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)'
);
$stmt->execute([$questionId, $visitor, $value]);

echo json_encode(['ok' => true]);
