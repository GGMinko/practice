document.addEventListener('DOMContentLoaded', () => {

    const ws = new WebSocket('ws://localhost:3000');
    const btn = document.querySelector('#request-keyword')
    const filesBlock = document.querySelector('.files')
    const downloadedBlock = document.querySelector('.downloaded')

    var fileBlocks = {};
    var filelist = [];

    function saveDataToLocalstorage(key, data, part) {
        // Check if local storage is supported in the browser
        if (typeof Storage !== 'undefined') {
            // Retrieve existing data from local storage
            let existingData = localStorage.getItem(key) || '';

            // Append the new data if part is not equal to 1
            if (part !== 1) {
                data = existingData + data;
            }

            // Save the data to local storage with the filename as the key
            localStorage.setItem(key, data);
            console.log(`Data saved to local storage with key: ${key}`);
        } else {
            console.error('Local storage is not supported in this browser');
        }
    }

    ws.onopen = () => {
    console.log('Connection opened');

    btn.addEventListener('click', () => {
        const keywordInput = document.getElementById('keyword');
        const keyword = keywordInput.value;

        ws.send(JSON.stringify({
        type: 'requestKeyword',
        keyword: keyword
        }))
    })
    };
    ws.onmessage = (event) => {
    const message = JSON.parse(event.data)

    console.log(event.data)

    if (message.type === 'responseKeyword') {
        fileBlocks = {};
        filesBlock.innerHTML = '';

        for (let key in message.links) {
            const fileContainer = document.createElement('div');
            fileContainer.classList.add('file-container', 'border', 'p-3', 'my-2', 'rounded');

            const fileName = document.createElement('div');
            fileName.classList.add('font-weight-bold');
            fileName.textContent = message.links[key];

            const progressBar = document.createElement('div');
            progressBar.classList.add('progress', 'mt-2');
            const progressBarInner = document.createElement('div');
            progressBarInner.classList.add('progress-bar', 'progress-bar-striped', 'progress-bar-animated');
            progressBarInner.setAttribute('role', 'progressbar');
            progressBarInner.setAttribute('aria-valuenow', '0');
            progressBarInner.setAttribute('aria-valuemin', '0');
            progressBarInner.setAttribute('aria-valuemax', '100');
            progressBar.appendChild(progressBarInner);

            const downloadBtn = document.createElement('button');
            downloadBtn.classList.add('btn', 'btn-primary', 'mt-2');
            downloadBtn.textContent = 'Save Offline';

            downloadBtn.addEventListener('click', () => {
                ws.send(JSON.stringify({ type: 'requestFile', link: message.links[key] }));
            });

            fileContainer.appendChild(fileName);
            fileContainer.appendChild(progressBar);
            fileContainer.appendChild(downloadBtn);

            fileBlocks[message.links[key]] = fileContainer;
            filesBlock.appendChild(fileContainer);
        }
    }

    if (message.type === 'responseFile') {
        let link = message.link;
        let progress = message.part / message.count;
        let data = message.data;
        let filename = message.filename;

        fileBlocks[link].querySelector('.progress-bar').setAttribute('aria-valuenow', progress * 100);
        fileBlocks[link].querySelector('.progress-bar').setAttribute('style', `width: ${progress * 100}%;`);
        saveDataToLocalstorage(filename, data, message.part)

        if (message.part == message.count) {

        fileBlocks[link].querySelector('.progress-bar').classList.add('bg-success')

        if (!filelist.includes(filename)) {
            addDownloadedBlock(filename)
            filelist.push(filename)
            saveFileList()
        }
        
        }
    }
    };
    ws.onclose = () => {
    console.log('Connection closed');
    };

    function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
    }

    function addDownloadedBlock(file) {
    const fileContainer = document.createElement('div');
    fileContainer.classList.add('file-container', 'border', 'p-3', 'my-2', 'rounded');

    const fileName = document.createElement('div');
    fileName.classList.add('font-weight-bold');
    fileName.textContent = file;

    const downloadBtn = document.createElement('button');
    downloadBtn.classList.add('btn', 'btn-primary', 'mt-2');
    downloadBtn.textContent = 'Download';
    downloadBtn.addEventListener('click', () => {
        const blob = dataURItoBlob(localStorage.getItem(file))

        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    })

    fileContainer.appendChild(fileName);
    fileContainer.appendChild(downloadBtn);

    downloadedBlock.appendChild(fileContainer);
    }

    function saveFileList() {
    localStorage.setItem('filelist', JSON.stringify(filelist))
    }

  filelist = JSON.parse(localStorage.getItem('filelist') || '[]')
  for (let key in filelist) {
    let file = filelist[key];
    addDownloadedBlock(file);
  }
})