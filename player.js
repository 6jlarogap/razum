// player.js

const YT_API_KEY = 'AIzaSyDFH5sy-cCqcSEp0BIl8DlW3fIfvMepYNU';

// Источник записи, по умолчанию yt: YouTube,
// но закладывается еще и pt: PeerTube
//
const SOURCE_YOUTUBE = 'yt';
const SOURCE_PEERTUBE = 'pt';

let auth_data;

let vidId = "nvVftQ2ZE94" // defaults
let vidUrl = "https://www.youtube.com/watch?v=" + vidId
let wsource = SOURCE_YOUTUBE;

let youtubePlayer, peerPlayer;
let vidTime;
let peerPosition = 0.0;

document.querySelector(".buttons__input--left").value = "0:00"
document.querySelector(".buttons__input--right").value = "0:00"

// адреса апи
var api_url = get_api_url()
var api_btn_url = "/api/wote/vote/"
var api_sum_url = "/api/wote/vote/sums/"
var api_user_votes_url = "/api/wote/vote/my/"
var api_auth_temp_token_url = "/api/token/authdata/"

const graph_url = get_graph_url();
const map_url = get_map_url();

// массивы для таблицы и графика
var timeGraphic = [0]
var fullTimeGraphic = ["0:00"]
var tdBtnTable = [0]
var dltBtnTable = [0]
var arrBtn1 = [0]
var arrBtn2 = [0]
var arrBtn3 = [0]

// Настройка графика
var chart = new Chart(document.getElementById("graphic"), { 
    type: 'line',
    data: {
      labels: fullTimeGraphic,
      datasets: [{ 
          data: arrBtn1, //Кнопка
          label: "Да", //Наименование кнопки
          borderColor: "#3cba9f", // зелёный
          fill: false
        }, { 
          data: arrBtn2,
          label: "Нет",
          borderColor: "#e06666", // алый
          fill: false 
        }, { 
          data: arrBtn3,
          label: "Неясно",
          borderColor: "#3e95cd", // синий
          fill: false
        }
      ]
    },
    options: {
        maintainAspectRatio : false,
        responsive: false,
        plugins: {
            title: {
                display: true,
                text: 'График нажатий кнопок по времени видео' //заголовок графика
            }
        },
        scales: {
            y: {
                title: {
                    display: true,
                    text: 'Количество нажатий' //надпись по оси y
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Время видео' //надпись по оси x
                }
            },
        },
        scale: {
            ticks: {
                precision: 0
              }
        }

    }
});

document.getElementById("graphic").onclick = function(event) {
    let points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
    if (points.length > 0) {
        let firstPoint = points[0];
        let labelAll = String(chart.data.labels[firstPoint.index]);
        const timeVideoSeconds = getTimeSeconds(labelAll);
        seekTo(timeVideoSeconds);
        timeForEdit(timeVideoSeconds)
    }
}


function seekTo(timeVideoSeconds) {
    if (wsource == SOURCE_YOUTUBE) {
        youtubePlayer.seekTo(timeVideoSeconds);
    } else if (wsource == SOURCE_PEERTUBE) {
        peerPlayer.seek(timeVideoSeconds);
    }
}

let dblClick = false
async function sendBtnEvent(btn, timeVideoSeconds) {
    if(!auth_data || dblClick) return;
    const button = document.getElementById(`id_btn_${btn}`);
    button.disabled = true;
    button.style.cursor = 'wait';
    dblClick = true
    const response = await api_request(api_url + api_btn_url, {
        method: 'POST',
        json: {
            source: wsource,
            videoid: vidId,
            button: btn,
            time: timeVideoSeconds
        },
        auth_token: auth_data.auth_token
    });
    if (response.ok) {  
        dblClick = false
        // ищем и удаляем строку с имеющимся голосом в это же время
        document.querySelectorAll(".td3Table").forEach(function(i) {
            if(getTimeSeconds(i.textContent) == timeVideoSeconds) {
                // в таблице уже есть голос с таким временем
                // замена голоса - удаляем имеющийся - новый отправится далее
                remVote(i)
                return; // голос найден - прерываем цикл
            }
        })
        createStrokTable(new Date(), btn, true, timeVideoSeconds) //создаем строку c подсветкой
        updateTimeAxis(timeVideoSeconds) // добавляем время на шкалу и в массивы графика
        if(btn == "yes") {
            arrBtn1[timeGraphic.indexOf(timeVideoSeconds)]++ //к элементу массива времени добавляем единицу   
        }
        if (btn == "no") {
            arrBtn2[timeGraphic.indexOf(timeVideoSeconds)]++
        }
        if (btn == "not") {
            arrBtn3[timeGraphic.indexOf(timeVideoSeconds)]++
        }   
        chart.update() //обновляем график        
    }
    button.disabled = false;
    button.style.cursor = 'pointer';
}

async function onDelBtnEvent(event) {
    if(!auth_data) return;
    const table = document.getElementById('id_timetable');
    table.style.cursor = 'wait';
    let timeSeconds = getTimeSeconds(event.previousSibling.textContent)
    const response = await api_request(api_url + api_btn_url, {
        method: 'DELETE',
        json: {
            source: wsource,
            videoid: vidId,
            time: timeSeconds
        },
        auth_token: auth_data.auth_token
    });
    if (response.ok) {
        // api returns nothing in this method
        // const data = response.data;
        remVote(event.previousSibling)
        chart.update()
    }
    table.style.cursor = null;
}

async function getUserVotes() {
    if(!auth_data) return;
    const response = await api_request(
        api_url + api_user_votes_url + '?source=' + wsource + '&videoid=' + vidId,
        {
            type: 'GET',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            auth_token: auth_data.auth_token
        }
    );
    if (response.ok) {
        const data = response.data;
        for (let t of data.votes) { // put user votes in table
            createStrokTable(new Date(t.update_timestamp * 1000), t.button, false, t.time)
        }
    } else { alert("getuservotes" + response); }
}

function createStrokTable(dateTime, btnName, bHighLight, timeVideoSeconds) {
    let day = dateTime.getDate() //получаем день
    let month = dateTime.getMonth() //получаем месяц
    let year = dateTime.getFullYear() //получаем год
    let hours = dateTime.getHours() //получаем часы
    let minutes = dateTime.getMinutes() //получаем минуты
    let seconds = dateTime.getSeconds() //получаем секунды
    //Добавляем нули к числам если они меньше 10
    if(day < 10) { day = "0" + day }
    if(month < 10) { month = "0" + (month + 1) } //добавляем единицу потому что в js месяца начинаются с нуля
    if(hours < 10) { hours = "0" + hours }
    if(minutes < 10) { minutes = "0" + minutes }
    if(seconds < 10) { seconds = "0" + seconds }

    trTable = document.createElement("tr") // создаем элемент tr
    tdTable = document.createElement("td") // создаем элемент td
    td2Table = document.createElement("td") // создаем элемент td
    td3Table = document.createElement("td") // создаем элемент td
    td4Table = document.createElement("td") // создаем элемент td
    trTable.append(tdTable, td2Table, td3Table, td4Table)
    trTable.classList.add("trBlockTable") //добавляем классы к строкам

    if(bHighLight) {
        trTable.classList.add("rowHigh--active") // накладываем временную подсветку
        setTimeout(function() { // убираем временную подсветку по таймауту
            trTable.classList.remove("rowHigh--active")
        }, 1000);
    }
    tdTable.textContent = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}` //засовываем в первую ячейку дату и время
    switch (btnName) {//во вторую ячейку пишем наименование кнопки
        case "yes":
            td2Table.textContent = "Да"
            break;
        case "no":
            td2Table.textContent = "Нет"
            break;
        case "not":
            td2Table.textContent = "Неясно"
            break;
    }
    let timeVideo = getFullTimeFunc(timeVideoSeconds)
    td3Table.classList.add("td3Table") //добавляем классы к ячейкам с временем
    td3Table.onmouseover = function() { addClassTd(this) }
    td3Table.onmouseout = function() { removeClassTd(this) }
    td3Table.textContent = timeVideo //помещаем в 3 ячейку время на видео
    td3Table.onclick = function() { 
      seekTo(timeVideoSeconds)
      timeForEdit(timeVideoSeconds)
      document.querySelector("#id_youtube_player").scrollIntoView({ //скроллим до плеера
          behavior: 'smooth',
          block: 'center'
      });
    }          
    td4Table.innerHTML = "<div class='delete-btn-table-block'><div class='delete-btn-table'></div></div>" //в 4 кнопку засовываем тег картинки
    td4Table.classList.add("delete-btn") //добавляем классы к кнопкам удаления с названием нажатых кнопок 
    td4Table.onclick = function() { onDelBtnEvent(this) } //ставим на них прослушку на кнопку удаления

    document.querySelector("tbody").prepend(trTable) //засовываем в html созданную строку
}

async function getSumVotes() {
    if(!auth_data) return;
    const response = await api_request(
        api_url + api_sum_url + '?source=' + wsource + '&videoid=' + vidId,
        {
            type: 'GET',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            auth_token: auth_data.auth_token
        }                            
    );
    if (response.ok) {
        // put data in table 
        const data = response.data;
        // put user votes in graph

        // перебор по атрибутам объекта data.buttons: yes, no, not
        for (let t of data.buttons.yes) {
            updateTimeAxis(t.time)
            arrBtn1[timeGraphic.indexOf(t.time)] = t.count
        }
        for (let t of data.buttons.no) {
            updateTimeAxis(t.time)
            arrBtn2[timeGraphic.indexOf(t.time)] = t.count
        }
        for (let t of data.buttons.not) {
            updateTimeAxis(t.time)
            arrBtn3[timeGraphic.indexOf(t.time)] = t.count
        }            
        chart.update() //обновляем график
    } else {
        alert("getsumvotes" + response);
    }
}

$(document).ready( async function() {
    auth_data = await check_auth(true);
    if (!auth_data) { return; };

    window.addEventListener('hashchange', function(){ //reload on hash change накладываем прослушку на строку урл
        window.location.reload();
    });

    await clearURL(window.location.href.toString());

    if(window.location.hash != ("#" + vidUrl)){
        if(window.location.hash){ // если хэш имеется - обновляем, нет - создаём
            window.location.hash = vidUrl
        } else {
            window.location.href += "#" + vidUrl
        }
    }
    // настройка проигрывателей
    if (wsource == SOURCE_YOUTUBE) {
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } // else if (wsource == SOURCE_PEERTUBE) {
    // }
    
    document.querySelectorAll(".btn").forEach(function(event) {  // ищем все кнопки и ставим на все кнопки прослушки
        event.addEventListener("click", function() {
            // если мы нажали на эту кнопку то..
            const timeVideoSeconds = Math.floor(getCurrentTime());

            if(event.textContent == "Да") { //если содержимое нажатой кнопки равно да/нет/неясно
                sendBtnEvent("yes", timeVideoSeconds)
            }
            else if(event.textContent == "Нет") {
                sendBtnEvent("no", timeVideoSeconds)
            }
            else if(event.textContent == "Неясно") {
                sendBtnEvent("not", timeVideoSeconds)
            }
        })
    })

    document.addEventListener("click", async function(event) {
        event.preventDefault();
        if(event.target.closest(".buttons__btn--map")) {
            let url_str = map_url + "/?videoid=" + vidId + "&source=" + wsource
                + "&f=" + getTimeSeconds(document.querySelector(".buttons__input--left").value)
                + "&t=" + getTimeSeconds(document.querySelector(".buttons__input--right").value)

            if (auth_data) {
                const response = await api_request(api_url + api_auth_temp_token_url, {
                    method: 'POST',
                    json: { auth_data: auth_data, },
                    auth_token: auth_data.auth_token
                });
                if (response.ok) { // put token in url
                    const data = response.data;
                    if (data.authdata_token) {
                        url_str += "&authdata_token=" + data.authdata_token
                    }
                }
            }
            openBtnLink(url_str)
        }
        if(event.target.closest(".buttons__btn--scheme")) {
            let url_str = graph_url +"/?videoid=" + vidId + "&source=" + wsource
                + "&f=" + getTimeSeconds(document.querySelector(".buttons__input--left").value)
                + "&t=" + getTimeSeconds(document.querySelector(".buttons__input--right").value)

            if (auth_data) {
                const response = await api_request(api_url + api_auth_temp_token_url, {
                    method: 'POST',
                    json: { auth_data: auth_data, },
                    auth_token: auth_data.auth_token
                });
                if (response.ok) { // put token in url
                    const data = response.data;
                    if (data.authdata_token) {
                        url_str += "&authdata_token=" + data.authdata_token
                    }
                }
            }
            openBtnLink(url_str)
        }
        if(event.target.closest(".graphic-button")) {
            getSumVotes()
        }
    })

    // получаем данные о суммах голосов
    await getSumVotes();
    await getUserVotes();
});

function getCurrentTime() {
    // текущие секунды на проигрывателе, с той точностью, которую дает проигрыватель
    if (wsource == SOURCE_YOUTUBE) {
        const timeVideoSeconds = youtubePlayer.getCurrentTime();
        result = timeVideoSeconds ? timeVideoSeconds : 0.0;
    }  else if (wsource == SOURCE_PEERTUBE) {
        result = peerPosition;
    }
    return result;

}

function getTimeSeconds(timeTableArr) { //функция перевода времени в секунды
    //Здесь мы переводим из часов, минут и секунд только в секунды
    timeTableArr = String(timeTableArr).match( /\d+/g )

    if(timeTableArr.length <= 2) { //если нету часов
        timeTableArr[0] *= 60
        return +(timeTableArr[0]) + +(timeTableArr[1]) //возвращаем полученное
    }
    if(timeTableArr.length > 2) { // если есть часы
        timeTableArr[0] *= 3600
        timeTableArr[1] *= 60
        return +(timeTableArr[0]) + +(timeTableArr[1]) + +(timeTableArr[2])
    }
}

document.querySelector(".form__btn").addEventListener("click", function(event) {
    if(window.location.href.includes(document.querySelector(".form__text").value)) {
        event.preventDefault()
    }
})

function btnForm() { //событие на нажатие кнопки Открыть
    let inUrl = document.querySelector(".form__text").value //получаем ссылку которую мы взяли из инпута
    console.log(inUrl)
    if(window.location.hash.includes(inUrl)){
        window.location.reload();
    } else {
        if(window.location.hash){ // если хэш имеется - обновляем, нет - создаём
            window.location.hash = inUrl
        } else { window.location.href += "#" + inUrl }
    }
}

function remVote(elem) {
    let timeSeconds = getTimeSeconds(elem.textContent)
    switch (elem.previousSibling.textContent) {
        case "Да":
            arrBtn1[timeGraphic.indexOf(timeSeconds)]-- //вычитаем единицу из элемента, индекс которого равен соседней ячейки с временем
            break;
        case "Нет":
            arrBtn2[timeGraphic.indexOf(timeSeconds)]--
            break;
        case "Неясно":
            arrBtn3[timeGraphic.indexOf(timeSeconds)]--
            break;    
    }
    if(arrBtn1[timeGraphic.indexOf(timeSeconds)] == 0 //если в точке времени у троих линий по нулям, то удаляем точку времени и точки у кнопок
    && arrBtn2[timeGraphic.indexOf(timeSeconds)] == 0 
    && arrBtn3[timeGraphic.indexOf(timeSeconds)] == 0) {
        arrBtn1.splice(timeGraphic.indexOf(timeSeconds), 1) //удаляем точку времени и и точки у кнопок
        arrBtn2.splice(timeGraphic.indexOf(timeSeconds), 1)
        arrBtn3.splice(timeGraphic.indexOf(timeSeconds), 1)
        fullTimeGraphic.splice(timeGraphic.indexOf(timeSeconds), 1) //удаляем точку времени
        timeGraphic.splice(timeGraphic.indexOf(timeSeconds), 1)
    }
    elem.parentNode.remove()
}
        
async function clearURL(urlStr) {
    if(urlStr.includes("#https://")) { //если в строке урл не будет никакой ссылки

        /*
         *  PeerTube videos urls. Возможны варианты:
         *      чаще всего:
                    (1) https://ijoo.ru/w/d95GcYHiowcbW67wX4WTPt
                но не исключается:
                    (2) https://ijoo.ru/videos/watch/d95GcYHiowcbW67wX4WTPt
                            делается redirect на (1)
                    (3) https://ijoo.ru/videos/embed/d95GcYHiowcbW67wX4WTPt
                            применяется для embed into iframe, но никто не запрещает
                            указать (3) в адресной строке
                ОДНАКО, возможно еще для того же видео:
                    (4) https://ijoo.ru/w/624e81a1-e9a9-462a-b6da-07b95a02d56d
                для устаревших PeerTube серверов единственно возможные варианты:
                    (5) https://ijoo.ru/videos/watch/624e81a1-e9a9-462a-b6da-07b95a02d56d
                            делается redirect на (4) в последних PeerTube серверах
                    (6) https://ijoo.ru/videos/embed/624e81a1-e9a9-462a-b6da-07b95a02d56d
                            применяется для embed into iframe, но никто не запрещает
                            указать (6) в адресной строке
            Пока заложены (1) - (3)? с короткими uuids.
            Они однозначно преобразуются в длинные, а длинные однозначно преобразуются в короткие,
            https://github.com/Chocobozzz/PeerTube/pull/4212 , но без разворачивания npm структуры,
            решение означенных преобразований пока не найдено.
            Даже после учета длинных uuids (варианты (4) - (6)), будем хранить в апи, как и сейчас,
            короткие uuids для идентификации PeerTube video.

            TODO
            Учесть длиннные uuids для Peertube videos.
        */
        const peerRegex = /\#(https?:\/\/[\w\.]+\.[\w]{2,10})\/(w|videos\/watch|videos\/embed)\/([0-9A-Za-z]{22})/;

        let youtubeUrlSep, peerMatch;
        if(urlStr.includes("https://www.youtube.com/watch?v=")) {  //если мы вставили обычную ссылку
            youtubeUrlSep = "watch?v="
        } else if(urlStr.includes("https://www.youtube.com/live/")) {  //если мы вставили live ссылку
            youtubeUrlSep = "live/"
        } else if(urlStr.includes("https://www.youtube.com/shorts")
        || urlStr.includes("https://youtube.com/shorts/")) {  //если мы вставили шортс ссылку
            youtubeUrlSep = "shorts/"
        } else if (urlStr.includes("https://youtu.be/")) { //если мы вставили укороченную ссылку
            youtubeUrlSep = "youtu.be/"
        } else if (peerMatch = peerRegex.exec(urlStr)) {
        }

        if (youtubeUrlSep) {
            // Это youtube video
            document.querySelector("#id_youtube_player").classList.remove("display--none");
            wsource = SOURCE_YOUTUBE;
            if(urlStr.includes("&t=")) {
                vidTime = urlStr.substring(urlStr.indexOf("&t="))
                    .replace("&t=", "")
                    .replace("s", "")//получаем секунды остановленного времени видео
            }

            vidId = urlStr //заполняем ид видео
                .split(youtubeUrlSep) //обрезаем урл
                .pop() //получаем последний элемент после youtubeUrlSep
                .replace('?feature=share','')
                .replace(/&t.*/, "");
            vidUrl = urlStr // заполняем урл видео
                .split("#") //обрезаем урл
                .pop() //обрезаем ссылку для урл
                .replace('?feature=share','');
            // console.log(vidId, vidUrl); // luKquWe89jo https://www.youtube.com/watch?v=luKquWe89jo

            fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${vidId}&key=${YT_API_KEY}`)
            .then(response => response.json())
            .then(data => {
                document.title = `КР-${data.items[0].snippet.title}`
            });
        } else if (peerMatch) {
            // Это PeerTube video
            wsource = SOURCE_PEERTUBE;
            vidUrl = `${peerMatch[1]}/${peerMatch[2]}/${peerMatch[3]}`;
            vidId = peerMatch[3];
            const peerSrc = `${peerMatch[1]}/videos/embed/${peerMatch[3]}?api=1&warningTitle=0`;
            const peerContainer = document.querySelector('#id_peer_player');
            peerContainer.classList.remove("display--none");
            peerContainer.src = peerSrc;
            const PeerTubePlayer = window['PeerTubePlayer'];
            peerPlayer = new PeerTubePlayer(peerContainer);
            peerPlayer.addEventListener('playbackStatusUpdate', (e) => peerStatusCall(e));
            peerPlayer.addEventListener('playbackStatusChange', (e) => peerStatusCall(e));
            await peerPlayer.ready;
            peerPlayer.play();
            /*
             * Не удается получить заголовок PeerTube видео.
             * await peerPlayer.getCaptions() по описанию
             * должно отдавать заголовок, но возвращает пустой массив.
            */
            document.title = 'Коллективный разум';
        }
    }
}

const peerStatusCall = (e) => {
    if (
        typeof(e) === 'object' &&
        'position' in e &&
        'playbackState' in e &&
         ["playing", "paused"].includes(e.playbackState)
      ) {
        if (peerPosition != e.position) {
            peerPosition = e.position;
            timeForEdit(Math.floor(peerPosition));
        }
    }
    // console.log(`Peertube position: ${peerPosition}`);
};


function onYouTubeIframeAPIReady() {
    youtubePlayer = new YT.Player("id_youtube_player", {
        videoId: vidId, //ид видео из урл
        events: {
            'onReady': onYoutubePlayerReady,
            'onStateChange': onYoutubePlayerStateChange,
        },
        playerVars: {
            'start': vidTime
        }
    });
}

function onYoutubePlayerStateChange() {
    timeForEdit(Math.floor(youtubePlayer.getCurrentTime()));
}

function onYoutubePlayerReady(event) { //заполнение инпут полей текущим временем из видео при проигрывании 
    event.target.playVideo();
    setInterval(() => {
        if(youtubePlayer.getPlayerState() == 1) {
            timeForEdit(Math.floor(youtubePlayer.getCurrentTime()))
            if(youtubePlayer.getPlayerState() == 2) {
                timeForEdit(Math.floor(youtubePlayer.getCurrentTime()))
            }
        }
    }, 100);
}

function addClassTd(elem) {
    const timeVideoSeconds = Math.floor(getCurrentTime());
    if(getTimeSeconds(elem.textContent) <timeVideoSeconds) {
        elem.classList.add("td3Table--right")
    }
    if(getTimeSeconds(elem.textContent) == timeVideoSeconds) {
        elem.classList.add("td3Table--middle")
    }
    if(getTimeSeconds(elem.textContent) > timeVideoSeconds) {
        elem.classList.add("td3Table--left")
    }
    elem.classList.add("hover")
}

function removeClassTd(elem) {
    const timeVideoSeconds = Math.floor(getCurrentTime());
    if(getTimeSeconds(elem.textContent) < timeVideoSeconds) {
        elem.classList.remove("td3Table--right")
    }
    if(getTimeSeconds(elem.textContent) == timeVideoSeconds) {
        elem.classList.remove("td3Table--middle")
    }
    if(getTimeSeconds(elem.textContent) > timeVideoSeconds) {
        elem.classList.remove("td3Table--left")
    }
    elem.classList.remove("hover")
}

function timeForEdit(time) {
    if(!(time - 1 < 0)) {
        document.querySelector(".buttons__input--left").value = getFullTimeFunc(time - 1)
    } else {
        document.querySelector(".buttons__input--left").value = "0:00"
    }
    document.querySelector(".buttons__input--right").value = getFullTimeFunc(time + 1)
}

function stopVideo() {
    youtubePlayer.stopVideo();
} 
/*
function mapSchemeLink(btn, url) {
    var href_url = btn + url + vidId + "&source=" + wsource
    + "&f=" + getTimeSeconds(document.querySelector(".buttons__input--left").value)
    + "&t=" + getTimeSeconds(document.querySelector(".buttons__input--right").value)
//    document.querySelector(btn).href = href_url 
    window.open(href_url, '_blank').focus();
}
*/

function openBtnLink(url_str) {
    window.open(url_str, '_blank').focus();    
}


function updateTimeAxis(timeVideoSeconds) {
    // добавление времени на шкалу и в массивы графика
    if(!timeGraphic.includes(timeVideoSeconds)) { // если времени нет в массиве
        timeGraphic.push(Math.floor(timeVideoSeconds)) //добавляем время в массив
        timeGraphic.sort(function(a, b) { //сортируем по возрастанию
            return a - b;
        });
        //добавляем к массивам кнопок нули для нового времени
        arrBtn1.splice(timeGraphic.indexOf(timeVideoSeconds), 0, 0) 
        arrBtn2.splice(timeGraphic.indexOf(timeVideoSeconds), 0, 0)
        arrBtn3.splice(timeGraphic.indexOf(timeVideoSeconds), 0, 0)
        // заполняем шкалу человекочитаемого времени
        fullTimeGraphic.splice(
            timeGraphic.indexOf(Math.floor(timeVideoSeconds)), 0, getFullTimeFunc(timeVideoSeconds)) //засовываем нормальное время в индекс под которым находится тоже самое время в секундах
    } 
}   

function getFullTimeFunc(timeVideoSeconds) { //функция перевода времени в часы, минуты и секунды
    // Раскладываем полученные из видео секунды на часы, минуты и секунды
    let playerHours = Math.floor(timeVideoSeconds / 60 / 60)
    let playerMinutes = Math.floor((timeVideoSeconds / 60) - (playerHours * 60))
    let playerSeconds = Math.floor(timeVideoSeconds % 60)

    // если секунды меньше десяти то добавляем 0
    if (playerSeconds < 10) {
        playerSeconds = "0" + playerSeconds
    }
    
    // если минуты меньше десяти то добавляем 0
    if (playerMinutes < 10 && playerHours >= 1) {
        playerMinutes = "0" + playerMinutes
    }

    // если останова не имеет часы то
    if(playerHours <= 0) {
        return `${playerMinutes}:${playerSeconds}` //возвращаем полученное
    }
    // если останова имеет часы то отображаем их
    if (playerHours > 0) {
        return `${playerHours}:${playerMinutes}:${playerSeconds}`
    }
    // если останова имеет часы и имеет минуты которые меньше 10
    if (playerHours > 0 && playerMinutes < 10) {
        return `${playerHours}:0${playerMinutes}:${playerSeconds}`
    }
}

document.addEventListener("click", function(event) {
    if(event.target.closest(".btn-popup")) {//накладываем прослушки на кнопку открытия модал. окна и кнопку закрытия модал. окна
        document.querySelector(".popup").classList.add("popup--active") //создаем нужный класс
        document.body.style.overflow = "hidden" //скрываем скролл
    }
    if(event.target.closest(".popup-close")) {
        document.querySelector(".popup").classList.remove("popup--active")
        document.body.style.overflow = "auto" //даем возможность скроллить
    }
})
