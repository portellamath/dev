import express from "express"
impor cors from "cors"

const app = express()

app.use(cors())
app.use(express())

app.get("/", (req, res) => {
    res.send("API ecommerce funcionando")
})

app.listen(3000, () => {
    console.log("servidor rodando")
})