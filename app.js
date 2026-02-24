async function load() {
const q = await fetch('api/get_questions.php').then(r=>r.json());
const a = await fetch('api/get_progress.php').then(r=>r.json());
const answers = Object.fromEntries(a.map(x=>[x.question_id, x.value]));


const div = document.getElementById('questions');
q.forEach(qu => {
const d = document.createElement('div');
d.innerHTML = `<p>${qu.text}</p>` +
[1,2,3,4,5].map(v=>
`<button onclick="answer(${qu.id},${v})" ${answers[qu.id]==v?'style="font-weight:bold"':''}>${v}</button>`
).join(' ');
div.appendChild(d);
});
}


function answer(q,v){
fetch('api/save_answer.php',{
method:'POST',
body:JSON.stringify({question_id:q,value:v})
});
}


async function submitTest(){
const r = await fetch('api/submit_results.php').then(r=>r.json());
document.getElementById('result').textContent = JSON.stringify(r,null,2);
}


load();