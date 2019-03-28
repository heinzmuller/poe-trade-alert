const fs = require('fs')
const chokidar = require('chokidar')
const axios = require('axios')

const config = require('./config.json')

const trades = {}

function formatNotificationMessage(whisper) {
    const price = whisper.match("listed for (.*?) in")
    const item = whisper.match("your (.*?) listed for")
    const tab = whisper.match("stash tab \"(.*?)\"")

    const message = []

    if (price) {
        message.push(`<strong>${price[1]}</strong>`)
    }

    if(item) {
        message.push(`<u>${item[1]}</u>`)
    }

    if (tab) {
        message.push(`<i>${tab[1]}</i>`)
    }

    return message.join(" - ")
}

function sendPushoverNotification(whisper) {
    const message = formatNotificationMessage(whisper)

    axios.post('https://api.pushover.net/1/messages.json', {
            token: config.token,
            user: config.user,
            message,
            html: 1,
        })
        .then(() => console.info('Sent notification for trade: '+ message))
}

function readLines(input, func, firstRun) {
    var remaining = '';

    input.on('data', function (data) {
        remaining += data;
        var index = remaining.indexOf('\n');
        var last = 0;
        while (index > -1) {
            var line = remaining.substring(last, index);
            last = index + 1;
            func(line, firstRun);
            index = remaining.indexOf('\n', last);
        }

        remaining = remaining.substring(last);
    });

    input.on('end', function () {
        if (remaining.length > 0) {
            func(remaining, firstRun);
        }
    });
}

function func(data, firstRun) {
    if (data.match("@From.*?would like to buy")) {
        const search = data.match(/[0-9]{4}\/[0-9]{2}\/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} (\d+)/)

        if(search[1]) {
            const id = search[1]

            if(trades[id]) {
                return
            }

            trades[id] = true

            if (firstRun) {
                return
            }

            sendPushoverNotification(data)
        }
    }
}

const readFile = (firstRun) => {
    var input = fs.createReadStream(config.clientTxt);
    readLines(input, func, firstRun);
}

readFile(true)

const change = () => readFile(false)

chokidar
    .watch(config.clientTxt)
    .on('change', change)
