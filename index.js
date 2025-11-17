const express = require("express");
require("dotenv").config();
const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

const serviceAccount = require("./smart-deals-firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

//middlewares
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
    console.log("logging user");
    next();
};

// const verifyFirebaseToken = async (req, res, next) => {
//     // console.log("verify firebase", req.headers.authorization);
//     if (!req.headers.authorization) {
//         return res.status(401).send({message: "Unauthorized access"});
//     }
//     const token = req.headers.authorization.split(" ")[1];
//     if (!token) {
//         return res.status(401).send({message: "Unauthorized access"});
//     }

//     // verify the token
//     try {
//         const userInfo = await admin.auth().verifyIdToken(token);
//         req.token_email = userInfo.email;
//         console.log("after token validation", userInfo);
//         next();
//     } catch {
//         return res.status(401).send({message: "Unauthorized access"});
//     }
// };

const verifyFirebaseAccessToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).send("Unauthorized User");
    }

    const token = authorization.split(" ")[1];
    if (!token) {
        res.status(401).send("Unauthorized User");
    }

    try {
        const decode = await admin.auth().verifyIdToken(token);
        console.log("decoded", decode);
        req.token_email = decode.email;
        next();
    } catch {
        return res.status(401).send("Unauthorized");
    }
};

// mongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5bt6oyo.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

app.get("/", (req, res) => {
    res.send("Smart deals server running");
});

async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ping: 1});

        const dataBase = client.db("smart_db");
        const productsCollection = dataBase.collection("products");
        const bidsCollection = dataBase.collection("bids");
        const userCollection = dataBase.collection("users");

        // JWT Api's
        app.post("/getToken", (req, res) => {
            const logedUser = req.body;
            const token = jwt.sign(logedUser, process.env.JWT_SECRET, {expiresIn: "1h"});
            res.send({token: token});
        });

        // user all api's
        app.post("/users", async (req, res) => {
            const newUser = req.body;
            const email = req.body.email;
            const query = {email: email};
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                res.send("user already exist");
            } else {
                const result = await userCollection.insertOne(newUser);
                res.send(result);
            }
        });

        // product api's here

        app.get("/products", async (req, res) => {
            console.log(req.query);
            const email = req.query.email;
            const query = {};
            if (email) {
                query.email = email;
            }

            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get("/latest-products", async (req, res) => {
            const cursor = productsCollection.find().sort({created_at: -1}).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = {_id: id};
            const result = await productsCollection.findOne(query);
            res.send(result);
        });

        app.post("/products", verifyFirebaseAccessToken, async (req, res) => {
            const newProducts = req.body;
            const result = await productsCollection.insertOne(newProducts);
            res.send(result);
        });

        app.patch("/products/:id", async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;
            const query = {_id: id};
            const update = {
                $set: {
                    updatedProduct,
                },
            };
            const options = {};
            const result = await productsCollection.updateOne(query, update, options);
            res.send(result);
        });

        app.delete("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = {_id: id};
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        });

        // bids api's

        app.get("/bids", logger, verifyFirebaseAccessToken, async (req, res) => {
            // console.log("headers", req.headers);
            const email = req.query.email;
            const query = {};
            if (email) {
                if (email !== req.token_email) {
                    return res.status(403).send({message: "forbidden user"});
                }
                query.buyer_email = email;
            }
            const cursor = bidsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get("/bids/:id", async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await bidsCollection.findOne(query);
            res.send(result);
        });

        app.get("/products/bids/:productId", verifyFirebaseAccessToken, async (req, res) => {
            const productId = req.params.productId;
            const query = {product: productId};
            const cursor = bidsCollection.find(query).sort({bid_price: 1});
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get("/bids", async (req, res) => {
            const email = req.body.email;
            const query = {};
            if (query.email) {
                query.buyer_email = email;
            }

            const cursor = bidsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post("/bids", async (req, res) => {
            const newBids = req.body;
            const result = await bidsCollection.insertOne(newBids);
            res.send(result);
        });

        app.delete("/bids/:id", async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await bidsCollection.deleteOne(query);
            res.send(result);
        });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        //
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`server running on port number ${port}`);
});
