
import jwt from "jsonwebtoken"
import { Router } from "express"
import pkg from '@prisma/client';
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import cloudinary from "cloudinary";
import { authMiddleware } from "../middleware.js";
import { createTaskInput } from "../types.js";
import { number, string } from "zod";
import { TOTAL_DECIMALS } from "../config.js";
// import { generateSignedUpload } from "../Cloudinary";


dotenv.config(); // load .env variables

const { PrismaClient } = pkg;

const JWT_SECRET = process.env.JWT_SECRET

const router = Router();

const prismaClient = new PrismaClient()

const DEFAULT_TITLE = "Select the most clickable thumbnail"

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


router.get("/task", authMiddleware, async (req, res) => {
    const taskId = req.query.taskId
    const userId = req.userId

    const taskDetails =  await prismaClient.task.findFirst({
        where:{
            user_id: Number(userId),
            id: Number(taskId)
        },
        include : {
            options: true
        }
    })



    if (!taskDetails) {
        return res.status(411).json({
            message: "You dont have access to this task"
        })
    }
    const responses = await prismaClient.submission.findMany({
        where:{
            task_id: Number(taskId)
        },
        include:{
            option: true
        }
    })
    const result = {
        count: number,
        option: {
            imageUrl: string
        }
    };  

    taskDetails.options.forEach(option => {
        result[option.id] = {
                count: 0,
                option: {
                    imageUrl: option.image_url
                }
            }
    })

    responses.forEach(r => {
        result[r.option_id].count++
    
    })

    res.json({
        result,
        taskDetails
    })
})


router.post ("/task", authMiddleware, async (req, res) =>{

    const body = req.body

    const parseData = createTaskInput.safeParse(body);

    if(!parseData.success) {
        console.log(parseData.error.format());
        return res.status(411).json({
            message: "You Have Sent The Wrong Inputs"
        })
    }


    let response = await prismaClient.$transaction(async tx => {
            const response = await tx.task.create({
                data:{
                    title: parseData.data.title ?? DEFAULT_TITLE,
                    // options: parseData.data.option
                    amount: 1 * TOTAL_DECIMALS,
                    signature: parseData.data.signature,
                    user_id: req.userId
                } 
            })

            await tx.option.createMany({
                data: parseData.data.options.map(x => ({
                    image_url: x.imageUrl,
                    task_id: response.id
                }))
            })
        return response
    })

    res.json({
        id: response.id
    })



})


router.get ("/signedUrl", authMiddleware, async (req, res) => {
    
   const userId = req.userId;
  const uniqueName = uuidv4();
  const folder = `user_uploads/${userId}`;
  const publicId = `${folder}/${uniqueName}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = cloudinary.v2.utils.api_sign_request(
    {
      timestamp,
      public_id: publicId,
    //   resource_type: "image", // force image
    },
    process.env.CLOUDINARY_API_SECRET
  );

  return res.json({
    upload_url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    timestamp,
    signature,
    public_id: publicId,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    // resource_type: "image"
  });
})


router.post("/signin", async(req, res) =>{
const hardcodeWalletAddress = "G3ozx5xtEqGAGi3VdsQGKGHxuwqSJDTn38vEUEREQweQ";
const esitingUser = await prismaClient.user.findFirst({
    where: {
        address: hardcodeWalletAddress
    }
})

if (esitingUser) {
    const token = jwt.sign({
        userId: esitingUser.id
    }, JWT_SECRET)

    res.json({
        token
    })
} else {
    const user = await prismaClient.user.create({
        data:{
            address : hardcodeWalletAddress,
        }
    })
    const token = jwt.sign({
        userId: user.id
    }, JWT_SECRET)
    res.json({
        token
    })
}
} ) 

export default router;