<?php
require '../db.php';
$visitor = $_COOKIE['visitor_id'];


$questions = [];
foreach ($pdo->query("SELECT * FROM questions") as $q)
$questions[$q['id']] = $q;


$sums = ['EI'=>0,'SN'=>0,'TF'=>0,'JP'=>0];


$stmt = $pdo->prepare("SELECT * FROM answers WHERE visitor_id = ?");
$stmt->execute([$visitor]);


foreach ($stmt as $a) {
$q = $questions[$a['question_id']];
$delta = $a['value'] - 3;
$sums[$q['dimension']] += $delta * $q['direction'] * $q['weight'];
}


$type = '';
$type .= $sums['EI'] > 0 ? 'E' : 'I';
$type .= $sums['SN'] > 0 ? 'S' : 'N';
$type .= $sums['TF'] > 0 ? 'T' : 'F';
$type .= $sums['JP'] > 0 ? 'J' : 'P';


$pdo->prepare("INSERT INTO results (visitor_id, type_code, detail_json)
VALUES (?, ?, ?)")
->execute([$visitor, $type, json_encode($sums)]);


echo json_encode(['type'=>$type,'scores'=>$sums]);
