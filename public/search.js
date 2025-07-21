// Funzione per ottenere il parametro dall'URL
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

document.getElementById('searchForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const requestId = document.getElementById('requestId').value;
    const searchResults = document.getElementById('searchResults');

    await performSearch(requestId, searchResults);
});

// Funzione per eseguire la ricerca
async function performSearch(requestId, searchResults) {
    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId })
        });
        const result = await response.json();

        if (response.ok) {
            if (result.request) {
                const { email, images } = result.request;
                let html = `<p><strong>Email:</strong> ${email}</p>`;
                html += `<p><strong>Codice:</strong> ${requestId}</p>`;
                html += `<p><strong>Immagini:</strong></p>`;
                if (images.length > 0) {
                    html += images.map(img => `<img src="/uploads/${img}" alt="Autografo" style="max-width: 200px; margin: 10px; border-radius: 8px;">`).join('');
                } else {
                    html += '<p>Nessuna immagine disponibile.</p>';
                }
                searchResults.innerHTML = html;
                searchResults.style.color = '#1a73e8';
            } else {
                searchResults.innerHTML = 'Nessuna richiesta trovata per questo codice.';
                searchResults.style.color = 'red';
            }
        } else {
            searchResults.innerHTML = `Errore: ${result.error}`;
            searchResults.style.color = 'red';
        }
    } catch (error) {
        searchResults.innerHTML = `Errore durante la ricerca: ${error.message}`;
        searchResults.style.color = 'red';
    }
}

// Esegui la ricerca automaticamente se requestId è nell'URL
window.onload = function() {
    const requestId = getQueryParam('requestId');
    const searchResults = document.getElementById('searchResults');
    if (requestId) {
        document.getElementById('requestId').value = requestId;
        performSearch(requestId, searchResults);
    }
};