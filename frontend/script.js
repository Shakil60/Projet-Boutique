const urlAPI = "http://localhost:3000/"

const btn = document.querySelector(".btn")
btn.addEventListener('click', getAllItems)

function getAllItems() {
    fetch(urlAPI + "items")
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error fetching data : ', error))
}