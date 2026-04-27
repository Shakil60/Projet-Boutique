const urlAPI = "http://localhost:3000/"

const btn = document.querySelector(".btn")
btn.addEventListener('click', getAllStudents)

function getAllStudents() {
    fetch(urlAPI + "students")
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error fetching data : ', error))
}

const btn1 = document.querySelector(".btn1")
btn1.addEventListener('click', getStudent1)

function getStudent1() {
    fetch(urlAPI + "students/1")
    .then(response => response.json())
    .then(data => console.log(data))
}