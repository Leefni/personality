<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
$offset = ($page - 1) * $perPage;

$total = (int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn();

$stmt = $pdo->prepare('SELECT id, text FROM questions ORDER BY id LIMIT :limit OFFSET :offset');
$stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();

json_success([
    'questions' => $stmt->fetchAll(),
    'page' => $page,
    'per_page' => $perPage,
    'total' => $total,
]);
