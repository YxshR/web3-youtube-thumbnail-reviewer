
import jwt from "jsonwebtoken"
import { Router } from "express"
import pkg from '@prisma/client';
import dotenv from "dotenv";
import { workerMiddleware } from "../middleware.js";
import { TOTAL_DECIMALS, WORKER_JWT_SECRET } from '../config.js'
import { getNextTask } from "../db.js";
import { createSubmissionInput } from "../types.js";

dotenv.config()



const router = Router ()

const { PrismaClient } = pkg;

const prismaClient = new PrismaClient()

const TOTAL_SUBMISSION = 100



router.post("/payout", workerMiddleware, async (req, res) => {
    const userId = req.workerId
    const worker = await prismaClient.worker.findFirst({
        where:{
            id: userId,

        }
    })

    if(!worker) {
        return res.status(403).json({
            message: "Worker not found"
        })
    }
    const address = worker.address

    const txnId = "0cdsbhcbdshbcyu"

    await prismaClient.$transaction(async tx => {
        await tx.worker.update ({
            where: {
                id: userId
            },

            data: {
                pending_amount: {
                    decrement: worker.pending_amount
                },
                locked_amount: {
                    increment: worker.pending_amount
                }

            }
        })
        await tx.payouts.create({
            data:{
                user_id: userId,
                amount: worker.pending_amount,
                status: "Processing",
                signature: txnId
            }
        })
    })


    return res.json({
        message: "Payout processed successfully",
        txnId
    })
})



router.get("/balance", workerMiddleware, async (req, res) => {

    const userId = req.workerId
    const worker = await prismaClient.worker.findFirst({
        where: {
            id: userId
        }
    })

    res.json({
        pending_amount: worker?.pending_amount,
        locked_amount : worker?.pending_amount
    })
})



router.post("/submission", workerMiddleware, async (req, res) => {
    console.log("Worker ID from JWT:", req.workerId, typeof req.workerId)
    const userId = req.workerId
    const body = req.body
    const parsebody = createSubmissionInput.safeParse(body)


    if(parsebody.success) {
        const task = await getNextTask(userId)


        if (!task || task?.id !== Number(parsebody.data.taskId)){
            return res.status(411).json({
                message: "Incorrect task ID"
            })
        }

        const selectedOptionId = Number(parsebody.data.selection)
        const validOption = task.options?.find(option => option.id === selectedOptionId)
        
        if (!validOption) {
            return res.status(400).json({
                message: "Invalid option selection for this task"
            })
        }
        
        
        const amount = Number(task.amount / TOTAL_SUBMISSION)

        const submission = await prismaClient.$transaction(async tx => {
                    const submission = await tx.submission.create({
                        data: {
                            option_id: Number(parsebody.data.selection),
                            worker_id: userId,
                            task_id: Number(parsebody.data.taskId),
                            amount: amount,
                        }
                    })

                    await tx.worker.update({
                        where: {
                            id: userId,
                        },
                        data: {
                            pending_amount: {
                                increment: amount
                            }
                        }
                    })

                    return submission
        })


        

        const nextTask = await getNextTask(Number(userId))
        res.json({
            nextTask,
            amount
        })


    } else {
        return res.status(400).json({
      message: "Invalid input",
      error: parsebody.error,
    });
    }
    
})



router.get("/nextTask",workerMiddleware, async (req, res) => {
    const userId = req.workerId

    const task = await getNextTask(Number(userId))
    

    if(!task) {
        res.status(411).json({
            message:"No more task left for you to review"
        })
    } else {
        res.status(411).json({
            task
        })
    }
})



router.post("/signin", async(req, res) =>{
const hardcodeWorkerWalletAddress = "0x9d7834C376B2b722c5693af588C3e7a03Ea8e44D";
const exsitingWorker = await prismaClient.worker.findFirst({
    where: {
        address: hardcodeWorkerWalletAddress
    }
})

if (exsitingWorker) {
    const token = jwt.sign({
        workerId: exsitingWorker.id
    }, WORKER_JWT_SECRET)

    res.json({
        token
    })
} else {
    const worker = await prismaClient.worker.create({
        data:{
            address : hardcodeWorkerWalletAddress,
            pending_amount: 0,
            locked_amount: 0
        }
    })
    const token = jwt.sign({
        workerId: worker.id
    }, WORKER_JWT_SECRET)
    res.json({
        token
    })
}
} ) 

export default router