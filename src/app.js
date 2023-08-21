import express from "express";
import cors from "cors";
import { MongoClient, Timestamp } from "mongodb";
import dotenv from "dotenv";
import joi from 'joi'
import dayjs from "dayjs";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config()

// ----------------------------- conexao com mongo -------------------------------
const mongoClient = new MongoClient('mongodb://localhost:27017/participants')
let db
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.message))

// --------------------------------- validações ----------------------------------

const userSchema = joi.object({
    name: joi.string().required(),
});

const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid("message","private_message")
})

// -------------------------------------- Rotas Posts  ----------------------------------

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const validation = userSchema.validate(name, { abortEarly: false });
    if (validation.error) {
        const erros = validation.error.details.map(det => det.message)
        return res.status(422).send(erros)
    }
    try {
        const resp = await db.collection("participants").findOne({ name });
        if (resp) return res.sendStatus(409);

        await db.collection("participants").insertOne({ name, lastStatus: Date.now() });

        const message = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(lastStatus).format("HH:mm:ss")
        }

        await db.collection("messages").insertOne({ message });


        return res.sendStatus(201);

    } catch (err) {
        return res.status(500).send(err);
    }

});



app.post("/messages", async (req, res) => {
    const {to, text, type} = req.body;
    const {user }= req.headers


    const validation = messageSchema.validate({...req.body , from: user}, { abortEarly: false });
    if (validation.error) {
        const erros = validation.error.details.map(det => det.message)
        return res.status(422).send(erros)
    }

    try {
        const participante = await db.collection("participants").findOne({ name: user });
        if (!participante) return res.sendStatus(422);
        
        const message = {...req.body, from: user, time: dayjs().format("HH:mm:ss")}

        await db.collection("messages").insertOne(message);
        
        return res.sendStatus(201);
        
    } catch (err) {
        return res.status(500).send(err)
    }
})

// -------------------------------------- Rotas Get's  ----------------------------------

app.get("/participants", async (req, res) => {

    try {
        const participantes = await db.collection("participants").find().toArray();
        res.send(participantes)
    } catch (error) {
        console.error(error)
        res.sendStatus(500)

    }
})



const PORT = 5000;
app.listen(PORT, () => console.log(`server runing on port ${PORT}`));
