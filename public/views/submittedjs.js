var seenPhotos = JSON.parse(Cookies.get('seenString'));
var nextSRC = "";
var srcURL = "";
var repeatCounter = 0;
var isFirst = true;
var hasFoundNew = false;

fetchPhoto();

window.onload = function() {
    var rating_buttons = document.getElementsByClassName('stars-class');
    for(var i = 0; i < rating_buttons.length; i++) {
        var button = rating_buttons[i];
        button.onclick = function() {
            getRating(this.innerHTML);
        }
    }
}

function getRating(rating) {

    params = `rating=${rating}&photoURL=${document.getElementById('judged-image').src}`
    const xhr = new XMLHttpRequest();
    xhr.open('POST','/submit-rating',true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(params);
    nextPhotoButton();

}

function resetCookie() {
    Cookies.set("submitted","false");
    Cookies.set('seenString','[]');
}

function nextPhotoButton() {
    hasFoundNew = false;
    fetchPhoto();
}

function fetchPhoto() {

    $("#judge-button").attr('value','Loading...');

    const xhr3 = new XMLHttpRequest();
    xhr3.onreadystatechange = () => {
        if(xhr3.readyState === 4 && xhr3.status === 200) {

            
            var seenFromCookie = JSON.parse(Cookies.get('seenString'));
            var responseParams = JSON.parse(xhr3.responseText);
            
            if(seenFromCookie.indexOf(responseParams.photoURL) > -1) {
                if(repeatCounter > 20) {
                    $("#judge-button").attr('value','No more photos');
                    $('#judged-image').attr('style','display:none');
                    $('#username').attr('style','display:none');
                    $('.stars-class').attr('style','display:none');
                } else {
                    fetchPhoto();
                }
                repeatCounter++;
            } else {
                if(responseParams.photoURL) {
                    $('#judged-image').attr('src', responseParams.photoURL);
                    $('#judged-image').attr('style','display:inline');
                    seenPhotos.push(responseParams.photoURL);
                    
                    $('#judged-image').one('load', function() {
                        $("#judge-button").attr('value', 'Skip photo');
                        $('#username').html(responseParams.username);
                    });
                    var seenString = JSON.stringify(seenPhotos);
                    Cookies.set('seenString', seenString);
                }
            }

        }
    }
    xhr3.open('GET','/get-photo-url');
    xhr3.send();

}