import express from "express";
import cors from "cors";
import { orderRouter } from "./routes/order";
import { balanceRouter } from "./routes/balance";

const app = express();

app.use(cors());
app.use(express.json());

app.use('/order', orderRouter);
app.use('/balance', balanceRouter);

app.listen(3000, () => {
    console.log('Server is running at port 3000');
})