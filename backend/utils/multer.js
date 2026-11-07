const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// ✅ Configure S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-west-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  requestHandler: {
    requestTimeout: 120000,
    socketTimeout: 120000,
  },
  maxAttempts: 3,
});

// ✅ Universal uploader factory function
const createUploader = (bucket, folder, allowedTypes, sizeLimit) => {
  return multer({
    storage: multerS3({
      s3,
      bucket: (req, file, cb) => {
        const target =
          (typeof bucket === "function" ? bucket(req, file) : bucket) ||
          process.env.AWS_S3_BUCKET ||
          process.env.AWS_RESUME_BUCKET ||
          process.env.AWS_IMAGE_BUCKET ||
          "skillnaavres";
        cb(null, target);
      },
      metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${folder}/${uniqueSuffix}${ext}`);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimetype = file.mimetype;

      if (allowedTypes.test(ext) && allowedTypes.test(mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Only ${allowedTypes} are allowed.`));
      }
    },
    limits: { fileSize: sizeLimit },
  });
};

// ✅ Reusable image uploader for subfolders like discover, vision, team, etc.
const imageUploader = (subfolder, maxSizeMB = 3) => {
  console.log("🪣 Uploading to bucket:", process.env.AWS_IMAGE_BUCKET);
  console.log("📁 Subfolder:", subfolder);
  return createUploader(
    process.env.AWS_IMAGE_BUCKET,
    subfolder,
    /jpe?g|png|webp|heic|heif|svg/,
    maxSizeMB * 1024 * 1024
  );
};


// ✅ Resume uploader
const resumeUpload = createUploader(
  process.env.AWS_RESUME_BUCKET,
  "resumes",
  /pdf|docx?/,
  5 * 1024 * 1024
);

// ✅ Profile pic / Age Verification selfie uploader
const profilePicUpload = createUploader(
  process.env.AWS_PROFILE_PIC_BUCKET || process.env.AWS_RESUME_BUCKET,
  "profile-pics",
  /jpe?g|png|gif|webp/,
  10 * 1024 * 1024
);

// ✅ Retry-enabled file upload (for buffers/files)
const uploadFile = async (params, retries = 3) => {
  const targetParams = {
    ...params,
    Bucket: params.Bucket || process.env.AWS_S3_BUCKET || process.env.AWS_RESUME_BUCKET || "skillnaavres",
  };
  for (let i = 0; i < retries; i++) {
    try {
      const command = new PutObjectCommand(targetParams);
      await s3.send(command);
      return `https://${targetParams.Bucket}.s3.${process.env.AWS_REGION || "us-west-1"}.amazonaws.com/${targetParams.Key}`;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// ✅ Upload offer letter from file
const uploadOfferLetter = async (localFilePath, fileName) => {
  const fileContent = fs.readFileSync(localFilePath);
  return uploadFile({
    Bucket: process.env.AWS_RESUME_BUCKET || process.env.AWS_S3_BUCKET || "skillnaavres",
    Key: `offer-letters/${fileName}`,
    Body: fileContent,
    ContentType: "application/pdf",
  });
};

// ✅ Upload offer letter from buffer
const uploadOfferLetterBuffer = async (buffer, fileName) => {
  return uploadFile({
    Bucket: process.env.AWS_RESUME_BUCKET || process.env.AWS_S3_BUCKET || "skillnaavres",
    Key: `offer-letters/${fileName}`,
    Body: buffer,
    ContentType: "application/pdf",
  });
};

const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".csv") cb(null, true);
    else cb(new Error("Only .csv files allowed"), false);
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// ✅ Chat file uploader
const chatFileUpload = createUploader(
  process.env.AWS_RESUME_BUCKET,
  "resumes",
  /jpe?g|png|gif|webp|pdf|docx?|txt/,
  10 * 1024 * 1024
);


module.exports = {
  resumeUpload,
  profilePicUpload,
  chatFileUpload,
  uploadOfferLetter,
  uploadOfferLetterBuffer,
  createUploader,  // if needed for custom cases
  imageUploader,   // 📌 Use this for discover/team/vision/feature uploads
  csvUpload,
  uploadFile,
};
