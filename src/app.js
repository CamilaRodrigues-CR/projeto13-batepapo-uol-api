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
    type: joi.string().required().valid("message", "private_message")
})

// -------------------------------------- Rotas Posts  ----------------------------------

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const validation = userSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
        const erros = validation.error.details.map(det => det.message)
        return res.status(422).send(erros)
    }
    try {
        const resp = await db.collection("participants").findOne({ name });
        if (resp) return res.sendStatus(409);

        const time = Date.now()
        await db.collection("participants").insertOne({ name, lastStatus:  time});

        const message = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(time).format("HH:mm:ss")
        }

        await db.collection("messages").insertOne({ message });


        return res.sendStatus(201);

    } catch (err) {
        console.error(err)
        return res.status(500).send(err);
    }

});



app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers


    const validation = messageSchema.validate({ ...req.body, from: user }, { abortEarly: false });
    if (validation.error) {
        const erros = validation.error.details.map(det => det.message)
        return res.status(422).send(erros)
    }

    try {
        const participante = await db.collection("participants").findOne({ name: user });
        if (!participante) return res.sendStatus(422);

        const message = { ...req.body, from: user, time: dayjs().format("HH:mm:ss") }

        await db.collection("messages").insertOne(message);

        return res.sendStatus(201);

    } catch (err) {
        return res.status(500).send(err)
    }
})

app.post("/status", async (req, res) => {
    const { user } = req.headers;

    if (!user) return res.sendStatus(404);

    try {
        const update = await db.collection("participants").updateOne(
            { name: user }, { $set: { lastStatus: Date.now() } }
        )

        return sendStatus(200)

    } catch (err) {
        return res.status(500).send(err);

    }
})

// -------------------------------------- Rotas Get's  ----------------------------------

app.get("/participants", async (req, res) => {

    try {
        const participantes = await db.collection("participants").find().toArray();
        res.send(participantes)
    } catch (err) {
        return res.status(500).send(err);

    }
})


app.get("/messages", async (req, res) => {
    const { user } = req.headers;
    const { limit } = req.query;
    const limitNumber = Number(limit);

    if (limit !== undefined && (limitNumber <= 0 || isNaN(limitNumber))) return res.sendStatus(422);

    try {
        const messages = await db.collection("messages").find(
            { $or: [{ from: user }, { to: { $in: ["Todos", user] } }, { type: "message" }] }
        ).limit(limit === undefined ? 0 : limitNumber).sort(({ $natural: -1 })).toArray();

        res.send(messages)


    } catch (err) {
        return res.status(500).send(err);

    }
})

//-------------------------------------------- Atualização ------------------------------

setInterval(async () => {
    const inative = Date.now() - 10000;

    try {
        const inativeUser = await db.collection("participants").find({ lastStatus: { $lt: inative } }).toArray();

        if (inativeUser.lenght > 0) {

            const message = inativeUser.map(inative => {
                return {
                    from: inative.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                }
            })


            await db.collection("messages").insertMany(message);
            await db.collection("participants").deleteMany({lastStatus: {$lt: inative}});

        }


    } catch (err) {
        return res.status(500).send(err);

    }
}, 15000)

// ------------------------------------------- Porta ------------------------------------

const PORT = 5000;
app.listen(PORT, () => console.log(`server runing on port ${PORT}`));
