<?php
require '../db.php';
$q = $pdo->query("SELECT * FROM questions ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($q);