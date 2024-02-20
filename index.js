const express = require('express')
/////////////////
const cors = require('cors')
//////////////////////////// MONGODB ///////////////////////////////////
const { MongoClient, ObjectId } = require('mongodb');
const uri = "mongodb+srv://meweed:096950Meww@cluster0.zuigism.mongodb.net/"
///////////////////////////// HASH ///////////////////////////////////
const bcrypt = require('bcrypt');
const saltRounds = 10;
//////////////////////////// TOKEN //////////////////////////////////
var jwt = require('jsonwebtoken')
const secret = 'mew'
//////////////////////// MIDDLEWARE? /////////////////////////////
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '../no2/aimg/')
    },
    filename: function (req, file, cb){
        const uniqueSuffix = Date.now() + '-'+ Math.round(Math.random()*1E9)
        cb(null,uniqueSuffix+'-'+file.originalname)
    }
})
const upload = multer({storage:storage}).single('file')
////////////////////////////////////////////////////////////////////////
const fs = require('fs')


const morgan = require('morgan')
const bodyParse = require('body-parser');
const { isDate } = require('util/types');
// const { parse } = require('path');
///////////////////////////////////////////////////////////////
const app  = express()  
const port = 3000
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))
app.use(bodyParse.json({limit:'10mb'}))

app.get('/', (req, res) => {
    res.send('Server - API - MongoDB ')
})

app.listen(port, () => {
    console.log(`Server listen at port http://localhost:${port}`)
})

const currentTime = new Date();

/////////////////////// API-AUTH-USER /////////////////////////////
//////////////////////////// LOGIN ////////////////////////////////////////
app.post('/login', async (req, res, next) => {
    const user = req.body;
    const client = new MongoClient(uri);
    try {
        await client.connect();

        const existingUser = await client.db("lastREMS").collection("users").findOne({ username: user.username });
        if (!existingUser) {
            return res.status(404).send({
                status: "error",
                message: "User not found."
            });
        }

        // เปรียบเทียบรหัสผ่านโดยใช้ Promise
        const passwordMatch = await bcrypt.compare(user.password, existingUser.password);
        if (!passwordMatch) {
            return res.status(401).send({
                status: "error",
                message: "Invalid password."
            });
        }
        const userInfo = await client.db("lastREMS").collection("users-info").findOne({ userId: existingUser._id});

        const token = jwt.sign({ id: existingUser.id, role: existingUser.role, userId: existingUser._id}, secret, {expiresIn: '1h'});
        
        res.status(200).send({
            status: "ok",
            message: "Login successful.",
            token,
            user: existingUser,
            userInfo: userInfo
        });
    } catch(err) {
        console.error("Error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error."
        });
    } finally {
        await client.close();
        next()
    }
});

app.post('/auth',(req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1]
        var decoded = jwt.verify(token, secret)
        res.json({status: 'ok',decoded})
    } catch(err) {
        res.json({status: 'error', message: err.message })
    }
})
app.post('/auths',(req, res) => {
    try {
        const token = req.body.jwt
        var decoded = jwt.verify(token, secret)
        res.json({status: 'ok', decoded})
    } catch(err) {
        res.json({status: 'error', message: err.message })
    }
})

app.post('/auth/user', async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, secret);

        const id = decoded.id;

        const client = new MongoClient(uri);
        await client.connect()
        const user = await client.db("lastREMS").collection("users")
        .findOne({"id": id });
        const userInfo = await client.db('lastREMS').collection("users-info")
        .findOne({"userId": user._id});
        const userLoca = await client.db('lastREMS').collection('users-location')
        .findOne({"userId":user._id})

        if (user) {
            res.json({ status: 'ok', userInfo, user, userLoca });
        } else {
            res.status(404).json({ status: 'error', message: 'User not found' });
        }

        await client.close();
    } catch(err) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
});
///////////////////////////////////// REGISTER ///////////////////////////////////////////////
app.post('/register', async (req, res, next) => {
    const user = req.body
    const client = new MongoClient(uri)
    try{
        if (user.username == null) {
            return res.status(400).send({
                "status": "error",
                "message": "Username required."
            })
        }/////// เช็คยูสเซอร์ null
        if (user.password != user.password2){
            return res.status(400).send({
                "status": "error",
                "message": "Password not match."
            });
        }/////// เช็ครหัสผ่าน
        const existingUser = await client.db("lastREMS").collection("users").findOne({ username: user.username });
        if (existingUser) {
            return res.status(400).send({
                "status": "error",
                "message": "Username already exists."
            });
        }/////// เช็คยูสเซอร์ซ้ำ
        const lastUser = await client.db("lastREMS").collection("users").findOne({}, { sort: { id: -1 } });
        let lastId = 0;
        if (lastUser) {
            lastId = lastUser.id+1
        } ////// ไอดีล่าสุด+1  
        const hash = bcrypt.hashSync(user.password, saltRounds);
        const userInsert = await client.db("lastREMS").collection("users").insertOne({
            id: lastId,
            username: user.username,
            password: hash,
            email: user.email||"",
            role: "member",
        });
        
        const token = jwt.sign({ id: lastId, role: "member",userId: userInsert.insertedId}, secret, {expiresIn: '1h'});
        const userId = userInsert.insertedId
        const userLoca = await client.db('lastREMS').collection('users-location').insertOne({
            userId: userId,
            address: user.address||"",
            country: user.country||"",
            city: user.city||"",
            dist: user.dist||"",
            subdist: user.subdist||"",
            zip: user.zip||""
            
        })
        const userInfo = await client.db("lastREMS").collection("users-info").insertOne({
            userId: userId,
            fname: user.fname||"",
            lname: user.lname||"",
            birthday: user.birthday||"",
            phone: user.phone||"",
            emerPhone: user.emerPhone||"",
            blood: user.blood||"",
            gender: user.gender||"",
            avatar: user.avatar||"",
            size: user.size||""
        })

        res.status(200).send({ 
            "status": "ok",
            "message": "User create with ID "+lastId+" .",
            token,
            "user": user,
            "userInfo": userInfo,
            "userLoca": userLoca
        })
    } catch(err){
        console.error("Error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error."
        });
    } finally {
        await client.close();
        next()
    }
})

app.post('/registeror', async (req, res, next) => {
    const user = req.body
    const client = new MongoClient(uri)
    try{
        if (user.username == null) {
            return res.status(400).send({
                "status": "error",
                "message": "Username required."
            })
        }/////// เช็คยูสเซอร์ null
        if (user.password != user.password2){
            return res.status(400).send({
                "status": "error",
                "message": "Password not match."
            });
        }/////// เช็ครหัสผ่าน
        const existingUser = await client.db("lastREMS").collection("users").findOne({ username: user.username });
        if (existingUser) {
            return res.status(400).send({
                "status": "error",
                "message": "Username already exists."
            });
        }/////// เช็คยูสเซอร์ซ้ำ
        const lastUser = await client.db("lastREMS").collection("users").findOne({}, { sort: { id: -1 } });
        let lastId = 0;
        if (lastUser) {
            lastId = lastUser.id+1
        } ////// ไอดีล่าสุด+1  
        const hash = bcrypt.hashSync(user.password, saltRounds);
        const userInsert = await client.db("lastREMS").collection("users").insertOne({
            id: lastId,
            username: user.username,
            password: hash,
            email: user.email||"",
            role: "organizer",
        });
        const token = jwt.sign({ id: lastId,role: "organizer",userId: userInsert.insertedId}, secret, {expiresIn: '1h'});
        const userId = userInsert.insertedId
        const userLoca = await client.db('lastREMS').collection('users-location').insertOne({
            userId: userId,
            address: user.address||"",
            country: user.country||"",
            city: user.city||"",
            dist: user.dist||"",
            subdist: user.subdist||"",
            zip: user.zip||""
            
        })
        const userInfo = await client.db("lastREMS").collection("users-info").insertOne({
            userId: userId,
            fname: user.fname||"",
            lname: user.lname||"",
            birthday: user.birthday||"",
            phone: user.phone||"",
            emerPhone: user.emerPhone||"",
            blood: user.blood||"",
            gender: user.gender||"",
            avatar: user.avatar||""
        })

        res.status(200).send({ 
            "status": "ok",
            "message": "User create with ID "+lastId+" .",
            token,
            "user": user,
            "userInfo": userInfo,
            "userLoca": userLoca
        })
    } catch(err){
        console.error("Error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error."
        });
    } finally {
        await client.close();
        next()
    }
})
////////////////////////////// AUTH ////////////////////////////////////




/////////////////////////////// USER ///////////////////////////////////
app.post('/users/create', async (req, res) => {
    const user = req.body
    const client = new MongoClient(uri);
    await client.connect()
    await client.db("lastREMS").collection("users").insertOne({
        // id: parseInt(user.id),
        // fname: user.fname,
        // lname: user.lname,
        // username: user.username,
        // password: user.password,
        // email: user.email,
    })
    await client.close();

    res.status(200).send({
        "status": "ok",
        "message": "User with ID "+ user.id+" is created",
        "user": user
    })
})

app.get('/users', async (req, res) => {
    const client = new MongoClient(uri);
    await client.connect()
    const users = await client.db("lastREMS").collection("users").find({}).toArray()
    // const usersInfo = await client.db("lastREMS").collection("users-info").find({}).toArray()
    await client.close();

    res.status(200).send(users )
})
app.get('/users/event',async (req, res) =>{
    const user = req.body
    const id = parseInt(user.id)
    const client = new MongoClient(uri);
    try{
        await client.connect()
        const founded = await client.db('lastREMS').collection('users').findOne({
            "id": id
        })
        const myEvent = await client.db('lastREMS').collection('events-joinner').find({
            "userId": founded._id
        })
        res.status(200).send(myEvent)
    }catch{

    }finally{
        await client.close()
    }
})

app.get('/joinevent',async (req,res) =>{
    const userId = req.body.userId
    const client = new MongoClient(uri)
    console.log(userId)
    await client.connect()
    try{
        const data = await client.db('lastREMS').collection('events-joinner').find({"userId":userId}).toArray() 
        console.log(data)
        res.status(200).send(data)
    }catch(err){

    }
})

//////////////// API เอา collection users + users-info ///////////////////////////


app.get('/users/info', async (req, res) => {
    const client = new MongoClient(uri);
    await client.connect();

    try {
        const users = await client.db("lastREMS").collection("users").aggregate([
            {
                $lookup: {
                    from: "users-info",
                    localField: "_id",
                    foreignField: "userId",
                    as: "userInfo"
                },
            },
            { $unwind: "$userInfo"},
            {
                $project: {
                    _id: 1,
                    id:1,
                    username: 1,
                    email: 1,
                    role: 1,
                    "userInfo.fname": 1,
                    "userInfo.lname": 1,
                    "userInfo.avatar": 1,
                    "userInfo.birthday": 1,
                    "userInfo.phone": 1,
                    "userInfo.emerPhone": 1,
                    "userInfo.blood": 1,
                }
            }
        ]).toArray();
        
        res.status(200).json(users);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            status: "error",
            message: "Internal server error."
        });
    } finally {
        await client.close();
    }
});

app.get('/users/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const client = new MongoClient(uri);
    await client.connect()
    const user = await client.db("lastREMS").collection("users").findOne({"id":id});
    const userInfo = await client.db("lastREMS").collection("users-info").findOne({"userId":user._id})
    const userLoca = await client.db("lastREMS").collection("users-location").findOne({"userId":user._id})
    await client.close();

    res.status(200).send({
        "status": "ok",
        "user": user,
        "userInfo": userInfo,
        "userLoca": userLoca
    })
})
//////// update ลง ////// users // users-info //////////
app.put('/users/update', async (req, res) => {
    const user = req.body;
    const id = parseInt(user.id)
    
    const client = new MongoClient(uri);
    await client.connect()
    let updateUser ={} //ขาด password ต้อง hash และต้องเช็คกับรหัสเก่า
    if (user.username){updateUser["username"] = user.username}
    if (user.email) {updateUser["email"] = user.email}
    let updateUserInfo ={}
    if (user.fname){updateUserInfo['fname'] = user.fname}
    if (user.lname){updateUserInfo['lname'] = user.lname}
    if (user.birthday){updateUserInfo['birthday'] = user.birthday}
    if (user.phone){updateUserInfo['phone'] = user.phone}
    if (user.emerPhone){updateUserInfo['emerPhone'] = user.emerPhone}
    if (user.blood){updateUserInfo['blood'] = user.blood}
    if (user.avatar){updateUserInfo['avatar'] = "/aimg/"+user.avatarurl}
    if (user.gender){updateUserInfo['gender'] = user.gender}
    let updateUserLoca ={}
    if (user.address){updateUserLoca['address'] = user.address}
    if (user.country){updateUserLoca['country'] = user.country}
    if (user.city){updateUserLoca['city'] = user.city}
    if (user.dist){updateUserLoca['dist'] = user.dist}
    if (user.subdist){updateUserLoca['subdist'] = user.subdist}
    if (user.zip){updateUserLoca['zip'] = user.zip}

    const users = await client.db("lastREMS").collection("users").updateOne({"id":id},{
        "$set": updateUser
    })
    if (users.matchedCount > 0){
        const userDoc = await client.db("lastREMS").collection("users").findOne({"id":id})
        const use_id = userDoc._id;
        await client.db("lastREMS").collection("users-info").updateOne({"userId":use_id},{
            "$set": updateUserInfo
        })
        await client.db("lastREMS").collection("users-location").updateOne({"userId":use_id},{
            "$set": updateUserLoca
        })
    }
    await client.close();
    res.status(200).send({
        "status": "ok",
        "message": "User ID"+user.id+" is updated.",
        // "user": users,
        // "userInfo": 
    })
})

app.delete('/users/delete', async (req, res) => {
    const id = parseInt(req.body.id)
    const client = new MongoClient(uri);
    try{
        await client.connect()
        const user = await client.db("lastREMS").collection('users').findOne({'id':id})
        await client.db("lastREMS").collection("users").deleteOne({'id':id});
        await client.db("lastREMS").collection("users-info").deleteOne({'userId':user._id});
        await client.db("lastREMS").collection("users-location").deleteOne({'userId':user._id});
        res.status(200).send({
            "status": "ok",
            "message": "User with ID = "+id+" is deleted."
        })
    }catch(err){
        res.status(500).send({
            "status": "error",
            "message": "Connect database failed!!!"
        })
    }finally{
        await client.close();
    }
})
//////////////////////////// USER ////////////////////////////////////

app.post('/events/register',upload, async (req, res) => {
    const event = req.body;
    if(req.file){
        event.file = req.file.filename
    }
    const client = new MongoClient(uri);
    try{
        await client.connect()
        const lastEvent = await client.db('lastREMS').collection('events').findOne({},{sort:{id:-1}});
        let lastId = 0
        if (lastEvent){
            lastId = lastEvent.id+1
        }
        const eventInsert = await client.db('lastREMS').collection('events').insertOne({
            id: lastId,
            title: event.title,
            about: event.about,
            day: event.day,
            month: event.month,
            year: event.year,
            min: event.min,
            hour: event.hour,
            coverimg: '/aimg/'+event.file,
            distance: event.distance,
            cost: event.cost,
        })

        const eventId = eventInsert.insertedId
        const eventLoca = await client.db('lastREMS').collection('events-location').insertOne({
            eventId: eventId,
            address: event.address||"ไม่ระบุ",
            country: event.country||"ไม่ระบุ",
            city: event.city||"ไม่ระบุ",
            dist: event.dist||"ไม่ระบุ",
            subdist: event.subdist||"ไม่ระบุ",
            zip: event.zip||"ไม่ระบุ",
        })
        const eventReward = await client.db('lastREMS').collection('events-reward')
        .insertOne({
            eventId: eventId,
            joinreward: event.joinreward,
            firstplace: event.firstplace,
            secondplace: event.secondplace,
            thirdplace: event.thirdplace,
        })
        res.status(200).json({
            status: "ok",
            message: "Event created with ID " +lastId,
            event: eventInsert,
            eventLoca: eventLoca,
            eventReward: eventReward,
            
        })
    }catch(err){
        console.error("Error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error."
        });
    }finally{
        await client.close()
    }
})

app.delete('/events/delete', async (req, res) => {
    const id = parseInt(req.body.id)
    const client = new MongoClient(uri);
    try{
        await client.connect()
        const event = await client.db("lastREMS").collection('events').findOne({'id':id})
        if(event?.file){
            await fs.unlink('../no2/aimg/'+ event.file, (err) => {
                if(err){
                    console.log(err)
                }else{
                    console.log('Remove success.')
                }
            })
        }
        await client.db("lastREMS").collection("events").deleteOne({'id':event.id});
        await client.db("lastREMS").collection("events-info").deleteOne({'eventId':event._id});
        await client.db("lastREMS").collection("events-location").deleteOne({'eventId':event._id});
        res.status(200).send({
            "status": "ok",
            "message": "User with ID = "+id+" is deleted."
        })
    }catch(err){
        res.status(500).send({
            "status": "error",
            "message": "Connect database failed!!!"
        })
    }finally{
        await client.close();
    }
})


//////////////////////////// EVENT /////////////////////////////////////
app.get('/events', async (req, res) => {
    const client = new MongoClient(uri);
    try{
        await client.connect()
        const event = await client.db("lastREMS").collection("events").aggregate([
            {
                $lookup:{
                    from: "events-location",
                    localField: "_id",
                    foreignField: "eventId",
                    as: "eventLoca"
                }
            }
        ]).toArray()
        res.status(200).send({
            "status": "ok",
            "events": event
        })


    }catch(err){
        res.status(500).send(err)
    }finally{
        await client.close();
    }
})
//
app.get('/join/events/:id', async (req, res) =>{
    const id = parseInt(req.params.id);
    const token =  req.headers.authorization.split(' ')[1]
    // console.log("JWT =", token)
    // console.log(userid)
    // console.log(role)
    const client = new MongoClient(uri);
    try{
        const decoded = jwt.verify(token, secret)
        var userid = decoded.id
        // var role = decoded.role
        await client.connect()
        const event = await client.db("lastREMS")
        .collection("events").findOne({"id":id})
        const eventLoca = await client.db("lastREMS")
        .collection('events-location').findOne({"eventId":event._id})
        const user = await client.db("lastREMS").collection("users")
        .findOne({'id':userid})
        const userInfo = await client.db("lastREMS").collection("users-info")
        .findOne({"userId":user._id})
        if (user){
            const userInfo = await client.db("lastREMS")
            .collection('users-info').findOne({"userId":user._id})
            const lastJoinner = await client.db("lastREMS")
            .collection('events-joinner').findOne({"eventId":event._id},{ sort: {runNo: -1}});
            let lastRunNo = 0
            if (lastJoinner){
                lastRunNo = lastJoinner.runNo+1
            }
            const eventJoiner = await client.db("lastREMS")
            .collection('events-joinner')
            .findOne({"eventId":event._id,"userId":user._id})
            if (eventJoiner) {
                res.status(401).json({
                    "status": "error",
                    "message": "เคยสมัครงานวิ่งนี้แล้ว"
                })
            }else{
               
                    await client.db("lastREMS")
                    .collection('events-joinner')
                    .insertOne({
                        "eventId":event._id,
                        "userId":user._id,
                        "joinAt": currentTime,
                        "size":  userInfo.size,
                        "runNo": lastRunNo,
                        "avatar": userInfo.avatar,
                        "email": user.email

                    })
                    res.status(200).json({
                        "status": "ok",
                        "message": "ลงสมัครงานวิ่งสำเร็จ"
                    })

            }

        }

        res.send({
            "status": "ok",
            "event": event,
            "eventLoca": eventLoca
        })
    }catch(err){
        
    }finally{
        await client.close();
    }
})

/////// ให้ events + events-location
app.get('/events/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const client = new MongoClient(uri);
    try {
        await client.connect()
        const event = await client.db("lastREMS")
        .collection("events").findOne({"id":id})
        const eventLoca = await client.db("lastREMS")
        .collection('events-location').findOne({"eventId":event._id})
        const eventJoiner = await client.db('lastREMS')
        .collection('events-joinner').find({"eventId":event._id}).toArray()

        res.status(200).send({
            "status": "ok",
            "event": event,
            "eventLoca": eventLoca,
            "eventJoiner": eventJoiner
        })
    }catch (err) {
        res.status(500).send({
            "status": "error",
            "message": "Internal server error"
        })
    }finally{
        await client.close();
    }
})


///////////////////// สร้าง event พร้อม เชื่อมกับ event-location
app.post('/events/create', async (req, res) => {
    const event = req.body
    const client = new MongoClient(uri);
    await client.connect()
    const lastEvent = await client.db("lastREMS").collection("events").findOne({}, { sort: { id: -1 } });
    let lastId = 0;
    if (lastEvent) {
        lastId = lastEvent.id+1
    }
    const events = await client.db("lastREMS").collection("events").insertOne({
        id: parseInt(lastId),
        title: event.title,
        about: event.about,
        day: event.day,
        month: event.month,
        year: event.year,
        min: event.min,
        hour: event.hour,
        ownerId: null
        // starttime: event.starttime
    })
    const eventID = events.insertedId
    /////////////// EVENTS + LOCATION ////////////////
    const location = await client.db("lastREMS").collection("location").insertOne({
        whoid: eventID,
        address: "",
        country:"",
        city: "",
        dist:"",
        subdist:"",
        zip:""
    })
    // needweed
    await client.close();

    res.status(200).send({ 
        "status": "ok",
        "message": "Event ID "+lastId+" is created",
        "event": event,
        "eventLoc": location
    })
})
////////////////////////////////////// 
app.put('/events/update', async (req, res) => {
    const event = req.body;
    const id = parseInt(event.id)
    
    const client = new MongoClient(uri);
    await client.connect()
    const events = await client.db("lastREMS").collection("events").updateOne({"id":id},{
        "$set": {
            title: event.title,
            about: event.about,
            day: event.day,
            month: event.month,
            year: event.year,
            starttime: event.starttime,
        }
    })
    await client.close();
    res.status(200).send({
        "status": "ok",
        "message": "User with ID = "+event.id+" is updated.",
        "event": events,
        // "userInfo": 
    })
})
/////// เอาใหม่ /////// 800 ///// NEWLOGIN

app.post('/auth/login', async (req, res, next) => {
    const data = req.body;
    const client = new MongoClient(uri);
    try {
        await client.connect();

        const existingEmail = await client.db("lastREMS").collection("users").findOne({ email: data.email});
        if (!existingEmail) {
            return res.status(404).send({
                status: "error",
                message: "User not found."
            });
        }

        // เปรียบเทียบรหัสผ่านโดยใช้ Promise
        const passwordMatch = await bcrypt.compare(data.password, existingEmail.password);
        if (!passwordMatch) {
            return res.status(401).send({
                status: "error",
                message: "Invalid password."
            });
        }
        const userInfo = await client.db("lastREMS").collection("users-info").findOne({ userId: existingEmail._id});

        const token = jwt.sign({ role: existingEmail.role, userId: existingEmail._id}, secret, {expiresIn: '1h'});
        var decoded = jwt.verify(token,secret)
        res.status(200).send({
            status: "ok",
            message: "Login successful.",
            token: token,
            role: decoded.role
        });
    } catch(err) {
        console.error("Error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error."
        });
    } finally {
        await client.close();
        next()
    }
});
/////////////////////// NEWREGIS member&organizer
app.post('/auth/regis',async (req, res) => {
    const data = req.body
    const client = new MongoClient(uri)
    try{
        await client.connect()
        console.log(data)
        // console.log("hello")
        if (data.email == null||data.email == ""){
            return res.status(400).send({
                status: "error",
                message: "Email required!!!"
            })
        }
        if(data.password != data.password2){
            return res.status(400).send({
                status: "error",
                message: "Password not match!!!"
            })
        }
        const existing = await client.db("lastREMS").collection("users").findOne({ email: data.email})
        if (existing){
            return res.json({
                "status": "error",
                "message": "Email already exists!!!"
            })
        }
        const hash = bcrypt.hashSync(data.password, saltRounds)
        const users = await client.db("lastREMS").collection("users").insertOne({
            username: data.username,
            password: hash,
            email: data.email,
            role: data.role
        })
        const token = jwt.sign({ _id: users.insertedId}, secret, {expiresIn: '2h'})
        await client.db('lastREMS').collection('users-location').insertOne({
            userId: users.insertedId,
            address: users.address||"",
            country: users.country||"",
            city: users.city||"",
            dist: users.dist||"",
            subdist: users.subdist||"",
            zip: users.zip||""
        })
        await client.db('lastREMS').collection('users-info').insertOne({
            userId: users.insertedId,
            fname: users.fname||"",
            lname: users.lname||"",
            day: users.day||"",
            month: users.month||"",
            year: users.year||"",
            phone: users.phone||"",
            emerPhone: users.emerPhone||"",
            blood: users.blood||"",
            gender: users.gender||"",
            avatar: users.avatar||"",
            size: users.size||""
        })
        res.status(200).json({
            "status":"ok",
            "message":"User created.",
            "token": token
        })
    }catch(err){
        res.status(500).send({
            "status": "error",
            "message": "Internal server error."
        })
    } finally{
        await client.close()
        // next()
    }
})

app.post('/jwtdecode', async (req, res) => {
    try{
        const token = req.body.jwt
        // console.log(token)
        var decoded = jwt.verify(token, secret)
        res.json({status:'ok',decoded})
    } catch(err){
        res.json({status: 'error', message: err.message})
    }
})

app.get('/load/users',async (req, res) =>{
    try{
        const client = new MongoClient(uri)
        await client.connect()
        const dataUsers = await client.db('lastREMS').collection('users').aggregate([
            {
                $lookup: {
                    from: 'users-info',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'userInfo'
                }
            },
            {
                $project: {
                    _id: 1,
                    email: 1,
                    role: 1,
                    "userInfo.fname": 1,
                    "userInfo.phone": 1,
                }
            }
        ]).toArray()
        res.json(dataUsers)
    } catch(err){
        console.error(err)
        res.status(500).json({error:'Internal Server Error!!'})
    }
})
app.get('/load/request',async (req, res) =>{
    try{
        const client = new MongoClient(uri)
        await client.connect()
        const dataRequest = client.db('lastREMS').collection('request')
        res.json(dataRequest)
    } catch(err){
        console.error(err)
        res.status(500).json({error:'Internal Server Error!!'})
    }
})

app.post('/auth/load/user',async (req, res) => {
    const token = req.body.jwt
    const client = new MongoClient(uri)
    const decoded = jwt.verify(token, secret)
    const uid = decoded.userId
    try{
        await client.connect()
        
    }catch{

    }
})
