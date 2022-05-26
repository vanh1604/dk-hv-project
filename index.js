const PORT = 3434;
const express = require('express')
const app = express();
const http = require('http').createServer(app)
const socketIo = require('socket.io')   //phai dung phien ban 1.7.3: <script src="/socket.io/socket.io.js"></script>
const ip = require('ip');
const mongoose = require('mongoose');
const {Schema, model} = mongoose
mongoose
    .connect('mongodb://localhost:27017/vong_co_cho_pet')
    .then(() => {
        console.log('Connected to vong_co_cho_pet database')
    })
    .catch((err) => {
        console.log('something went wrong when collecting to database');
        console.log(err);
    })
const PetSchema = new Schema({
    petName: String,
    nhietDo: Number,
    loc: {
        long: Number,
        lat: Number,
    },
    nhipTim: {
        type: Schema.Types.ObjectId,
        ref: 'nhipTim'
    },
    O2: {
        type: Schema.Types.ObjectId,
        ref: 'O2'
    },
    CO: {
        type: Schema.Types.ObjectId,
        ref: 'CO'
    }
})
const nhipTimSchema = new Schema({
    time: Date,
    nhipTim: Number,
})
const O2Schema = new Schema({
    time: Date,
    O2: Number,
})
const COSchema = new Schema({
    time: Date,
    CO: Number,
})
const nhietDoSchema = new Schema({
    time: Date,
    nhietDo: Number,
})

const Pet = model('pet', PetSchema);
const NhipTim = model('nhipTim', nhipTimSchema);
const O2 = model('O2', O2Schema);
const CO = model('CO', COSchema);
const nhietDo = model('nhietDo', nhietDoSchema);

app.use(express.static(__dirname));
app.use(express.static("public"));

let io = socketIo(http)


http.listen(PORT);
console.log("Server nodejs chay tai dia chi: " + ip.address() + ":" + PORT)
// app.listen(PORT, () => {
//     console.log("Server nodejs chay tai dia chi: " + ip.address() + ":" + PORT)
// })

app.get("/", (req, res) => {
    res.sendFile(__dirname + '/public/neck.html');
})


/**
 * phan tich du lieu nhan duoc
 * @param jsonData    raw data
 * @returns {null|any} data
 */
function parseJson(jsonData) {
    try {
        return JSON.parse(jsonData);
    } catch (error) {
        return null;
    }
}

const clients = []; //danh sach client
/**
 * msg thông qua server sẽ được gửi đi các client khác mà
 * không nhận lại tin của chính mình
 * @param socket
 * @param data
 */
function broadcast(socket, event, data) {
    for (let i = 0; i < clients.length; i++) {
        if (clients[i] !== socket) {
            clients[i].emit(event, data);
        }
    }
}

//Khi có mệt kết nối được tạo giữa Socket Client và Socket Server
io.on('connection', function (socket) {
    console.log("Connected");
    clients.push(socket);   //them client vao danh sach client dang ket noi

    io.sockets.emit('totalDevice', clients.length); //cap nhat so luong client

    let led = true
    const interval1 = setInterval(function () {
        //đảo trạng thái của mảng led, nhap nhay led
        led = !led;
        let json = {
            "led": led
        }
        socket.emit('LED', json) //Gửi lệnh LED với các tham số của của chuỗi JSON
        io.sockets.emit('MAX30100', Math.floor(Math.random() * 2 + 37))
    }, 5000)//5000ms

    /*event handler cho esp client*/
    //led status, cai nay co the bo di
    socket.on('LED_STATUS', function (message) {
        broadcast(socket, 'LED_STATUS', message); //gui lai thong tin ve cho web client
        console.log("LED thong tin tu esp: ", message.message);  //log
    });
    //chi so gas: mq2
    socket.on('MQ2', (message) => {
        broadcast(socket, 'MQ2', message); //gui lai thong tin ve cho web client
        console.log("MQ2: ", message.MQ2)
    })
    //button    //cai nay cung co the bo di
    socket.on('BTN', (message) => {
        broadcast(socket, 'BTN', message.message); //gui lai thong tin ve cho web client
        console.log(message.message)
    })
    //HCSR501
    socket.on('HCSR501', (message) => {
        broadcast(socket, 'HCSR501', message); //gui lai thong tin ve cho web client
        console.log(message.message)
    })
    //cam bien than nhiet
    socket.on('MAX30100', (message) => {
        broadcast(socket, 'MAX30100', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //cam bien C0
    socket.on('CO', (message) => {
        broadcast(socket, 'CO', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })
    //SPO2
    socket.on('SP02', (message) => {
        broadcast(socket, 'SP02', message); //gui lai thong tin ve cho web client
        console.log(message.message);
    })

    /*event handler cho web client*/
    socket.on('msg', function (data) {
        console.log(data);
        broadcast(socket, 'msg', data);
    });
    socket.on('LED', (data) => {
        console.log(data);
        broadcast(socket, 'LED', data)
    })
    socket.on('UPDATE', (data) => {
        console.log('update')
        broadcast(socket, 'UPDATE', data)
        io.sockets.emit('MAX30100', Math.floor(Math.random() * 2 + 37))
    })


    /*disconnect event*/
    socket.on('disconnect', function (data) {
        let index = clients.indexOf(socket);
        clients.splice(index, 1);    //xoa client mat ket noi di
        console.log("a client disconnected");
        io.sockets.emit('totalDevice', clients.length);
        clearInterval(interval1)
    });
});

