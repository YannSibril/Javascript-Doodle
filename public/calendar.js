'use strict';
// Jean Michel Cid Matrciule: 20031706 SAAH Yann Matricule: 20061840

//getions d'évenement
document.addEventListener('DOMContentLoaded', function () {

    var cal = document.getElementById("calendrier");
});

var interval;
window.onmousedown = function () {
    interval = setInterval(handleMouseDown, 1);
};

window.onmouseup = function () {
    clearInterval(interval);
};

function handleMouseDown() {
    pressed = true;

}
var pressed = false;

function onClick(event) {
    // TODO
    console.log(event);
    var t = event.target;
    var id = t.id;
    var cal = document.getElementById("calendrier");

    if (id != 'calendrier' && id != 'dateJour') {
        t.innerHTML = (t.innerHTML == "") ? "&#x2714;" : "";
    }
}

function onMove(event) {
    // TODO

    var t = event.target;
    var id = t.id;
    if (pressed && id != 'calendrier' && id != 'dateJour') {
        t.innerHTML = (t.innerHTML == "") ? "&#x2714;" : "";
        pressed = false;
    }
    pressed = false;
    console.log(pressed);
    pressed = false;
}

// Cette fonction doit retourner une série de zéros et de uns qui encode
// les disponibilités sélectionnées, de gauche à droite et de haut en bas.
// C'est cette valeur qui sera envoyée au serveur.
var compacterDisponibilites = function () {

    var cal = document.getElementById("calendrier");

    var dispo = "";
    var id = "";

    for (var i = 1; i < +cal.dataset.nbheures + 1; i++) {
        for (var j = 1; j < +cal.dataset.nbjours + 1; j++) {
            id = i + "-" + j;

            if (document.getElementById(id).innerHTML != null) {
                if (encodeURIComponent(document.getElementById(id).innerHTML) == "%E2%9C%94")
                    dispo += "1";
                else dispo += "0";
            }
            else dispo += "";
        }
    }
    return dispo;
};
