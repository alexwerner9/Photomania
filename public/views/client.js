function resetCookie() {
    Cookies.set("submitted","false");
}

var counter = 0;

if(Cookies.get('submitted') == "true") {
    $('#upload-button').prop('disabled',true);
    $('#upload-button').attr('value','Submitted');
    $('#reddit-name').attr('disabled',true);
    location.replace("/photomania-submitted");
}

$("#file-input").change(function() {
    $('#select-text').html(document.getElementById('file-input').files[0].name);
});

function submitFile() {

    const files = document.getElementById('file-input').files;
    const file = files[0];

    if(!file.type.includes('image')) {
        alert("Not an accepted image file");
        return;
    }

    if(file.size > 26214400) {
        alert("File too big. Must be less than 25 MB");
        return;
    }

    if(Cookies.get('submitted') == "true") {
        console.log("Already submitted.");
    } else {
        if(file == null) {
            return alert("No file selected");
        } else {
            $('#upload-button').attr('value','Uploading...');
            getSignedRequest(file);
        }
        
    }

}

function getSignedRequest(file) {
    const xhr = new XMLHttpRequest();
    var filename = encodeURIComponent(file.name);
    var filetype = encodeURIComponent(file.type);
    var encoded_username = encodeURIComponent(document.getElementById('reddit-name').value);
    xhr.open('GET',`/sign-s3?file-type=${filetype}&username=${encoded_username}`);
    xhr.onreadystatechange = () => {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                uploadFile(file, response.signedRequest, response.url);
            }
            else {
                alert('Could not upload file');
            }
        }
    };
    xhr.send();
}

function uploadFile(file, signedRequest, url) {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedRequest);
    xhr.onreadystatechange = () => {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                Cookies.set('submitted','true');
                Cookies.set('seenString',"[]");

                $('#upload-button').prop('disabled',true);
                $('#upload-button').attr('value','Submitted');
                location.replace('../photomania-submitted')
            } else {
                alert("Could not upload file");
            }
        }
    };
    xhr.send(file);
}