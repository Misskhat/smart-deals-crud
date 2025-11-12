const express = require("express");
const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

//middlewares
app.use(cors());
app.use(express.json());

// mongoDB setup
const uri = "mongodb+srv://simpleDBUser:mdzu-FMwmY3z3P@cluster0.5bt6oyo.mongodb.net/?appName=Cluster0";

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

        // all api's here

        app.get("/products", async (req, res) => {
            const cursor = productsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await productsCollection.findOne(query);
            res.send(result);
        });

        app.post("/products", async (req, res) => {
            const newProducts = req.body;
            const result = await productsCollection.insertOne(newProducts);
            res.send(result);
        });

        app.patch("/products/:id", async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;
            const query = {_id: new ObjectId(id)};
            const update = {
                $set: {
                    name: updatedProduct.name,
                    price: updatedProduct.price,
                },
            };
            const options = {};
            const result = await productsCollection.updateOne(query, update, options);
            res.send(result);
        });

        app.delete("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await productsCollection.deleteOne(query);
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
