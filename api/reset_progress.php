<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$visitor = $_COOKIE['visitor_id'] ?? '';
if ($visitor === '') {
    echo json_encode(['ok' => true]);
    exit;
}

$deleteAnswers = $pdo->prepare('DELETE FROM answers WHERE visitor_id = ?');
$deleteAnswers->execute([$visitor]);

$deleteResults = $pdo->prepare('DELETE FROM results WHERE visitor_id = ?');
$deleteResults->execute([$visitor]);

echo json_encode(['ok' => true]);
