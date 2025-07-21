document.getElementById('uploadForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const fileInput = document.getElementById('autographs');
    const responseMessage = document.getElementById('responseMessage');

    if (fileInput.files.length < 3) {
        responseMessage.innerHTML = 'Per favore, carica almeno 3 immagini.';
        responseMessage.style.color = 'red';
        return;
    }

    const formData = new FormData();
    formData.append('email', email);
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('autographs', fileInput.files[i]);
    }

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            responseMessage.innerHTML = `Thank you for using GC30! Request submitted successfully. Code: ${result.requestId}`;
            responseMessage.style.color = '#1a73e8';
        } else {
            responseMessage.innerHTML = `Errore: ${result.error}`;
            responseMessage.style.color = 'red';
        }
    } catch (error) {
        responseMessage.innerHTML = 'Errore durante l\'invio. Riprova.';
        responseMessage.style.color = 'red';
    }
});