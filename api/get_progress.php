<?php
require '../db.php';
$visitor = $_COOKIE['visitor_id'] ?? '';
$stmt = $pdo->prepare("SELECT question_id, value FROM answers WHERE visitor_id = ?");
$stmt->execute([$visitor]);
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
