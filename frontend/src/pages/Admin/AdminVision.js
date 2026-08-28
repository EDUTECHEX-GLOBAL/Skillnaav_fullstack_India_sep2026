import React, { useState, useEffect, useCallback } from "react";
import { Modal, Form, Input, Button, message, List, Skeleton } from "antd";
import axios from "../../api/axiosInstance";

const { TextArea } = Input;

const AdminVision = () => {
  const [skillnaavData, setSkillnaavData] = useState(null);
  const [modalData, setModalData] = useState({
    isVisible: false,
    type: "",
    data: null,
  });
  const [form] = Form.useForm();
  const [imgUrl, setImgUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchSkillnaavData = useCallback(async () => {
    try {
      const response = await axios.get("/api/skillnaav/get-skillnaav-data");
      setSkillnaavData(response.data);
      if (response.data.visionhead?.length > 0) {
        setImgUrl(response.data.visionhead[0].visionImg || "");
        setPreviewUrl(response.data.visionhead[0].visionImg || "");
      }
    } catch (error) {
      console.error("Error fetching skillnaav data:", error);
    }
  }, []);

  useEffect(() => {
    fetchSkillnaavData();
  }, [fetchSkillnaavData]);

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result);
    reader.readAsDataURL(selectedFile);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const { data } = await axios.post("/api/upload/vision-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data.success) {
        setImgUrl(data.imageUrl);
        message.success("Image uploaded successfully");
      } else {
        message.error("Failed to upload image");
      }
    } catch (error) {
      console.error("S3 upload error:", error);
      message.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = useCallback(
    async (values) => {
      try {
        let response;
        if (modalData.type === "editHead") {
          const { _id } = modalData.data;
          response = await axios.put(
            `/api/skillnaav/update-visionhead/${_id}`,
            {
              ...values,
              visionImg: imgUrl,
            }
          );
        } else if (modalData.type === "editPoint") {
          const { _id } = modalData.data;
          values._id = _id;
          response = await axios.put(
            `/api/skillnaav/update-visionpoint/${_id}`,
            values
          );
        } else if (modalData.type === "addPoint") {
          response = await axios.post("/api/skillnaav/add-visionpoint", values);
        }

        if (response.data.success) {
          message.success(response.data.message);
          setModalData({ isVisible: false, type: "", data: null });
          fetchSkillnaavData();
          form.resetFields();
          setPreviewUrl("");
        } else {
          message.error(response.data.message);
        }
      } catch (error) {
        message.error(`Error ${modalData.type}: ${error.message}`);
      }
    },
    [modalData, form, fetchSkillnaavData, imgUrl]
  );

  const handleDelete = useCallback(
    async (id) => {
      try {
        const response = await axios.delete(
          `/api/skillnaav/delete-visionpoint/${id}`
        );
        if (response.data.success) {
          message.success(response.data.message);
          fetchSkillnaavData();
        } else {
          message.error(response.data.message);
        }
      } catch (error) {
        message.error(`Error deleting vision point: ${error.message}`);
      }
    },
    [fetchSkillnaavData]
  );

  const openModal = useCallback(
    (type, data = null) => {
      setModalData({ isVisible: true, type, data });
      if (data) {
        form.setFieldsValue(data);
        if (data.visionImg) {
          setImgUrl(data.visionImg);
          setPreviewUrl(data.visionImg);
        }
      }
    },
    [form]
  );

  if (!skillnaavData) {
    return (
      <div className="flex justify-center items-center h-full">
        <Skeleton active avatar />
      </div>
    );
  }

  const { visionhead, visionpoint } = skillnaavData;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="border p-4 rounded-lg bg-white shadow-md">
          <h1 className="text-2xl font-semibold mb-4">Vision Head</h1>
          <div className="mb-4">
            <p className="text-lg mb-2 font-semibold">Heading:</p>
            <p className="mb-2">{visionhead[0]?.visionheading}</p>
          </div>
          <div className="mb-4">
            <p className="text-lg mb-2 font-semibold">Sub Heading:</p>
            <p className="mb-2">{visionhead[0]?.visionsub}</p>
          </div>
          {imgUrl && (
            <div className="mb-4">
              <p className="text-lg mb-2 font-semibold">Image:</p>
              <img
                src={imgUrl}
                alt="Vision preview"
                className="max-w-full h-auto rounded"
                style={{ maxHeight: "400px", objectFit: "cover" }}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button
              type="primary"
              onClick={() => openModal("editHead", visionhead[0])}
            >
              Edit Vision Head
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="border p-4 rounded-lg bg-white shadow-md">
          <h1 className="text-2xl font-semibold mb-4">Vision Points</h1>
          <List
            itemLayout="horizontal"
            dataSource={visionpoint}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    onClick={() => openModal("editPoint", item)}
                    className="text-blue-500"
                  >
                    Edit
                  </Button>,
                  <Button
                    type="link"
                    onClick={() => handleDelete(item._id)}
                    className="text-red-500"
                  >
                    Delete
                  </Button>,
                ]}
              >
                <List.Item.Meta title={item.visionpoint} />
              </List.Item>
            )}
          />
          <div className="flex justify-end mt-4">
            <Button
              type="primary"
              onClick={() => openModal("addPoint")}
              className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Add Vision Point
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={modalData.isVisible}
        title={
          modalData.type === "editHead"
            ? "Edit Vision Head"
            : modalData.type === "editPoint"
            ? "Edit Vision Point"
            : "Add Vision Point"
        }
        onCancel={() =>
          setModalData({ isVisible: false, type: "", data: null })
        }
        footer={null}
      >
        <Form layout="vertical" onFinish={handleFinish} form={form}>
          {modalData.type === "editHead" ? (
            <>
              <Form.Item
                name="visionheading"
                label="Vision Heading"
                rules={[{ required: true, message: "Please enter heading" }]}
              >
                <TextArea rows={4} />
              </Form.Item>
              <Form.Item
                name="visionsub"
                label="Vision Sub Heading"
                rules={[{ required: true, message: "Please enter sub heading" }]}
              >
                <TextArea rows={4} />
              </Form.Item>
              <Form.Item
                label="Upload Vision Image"
                rules={[{ required: true, message: "Please upload image" }]}
              >
                <input type="file" onChange={handleFileUpload} />
                {uploading ? (
                  <div className="mt-2">
                    <Skeleton.Avatar active size="small" />
                    <Skeleton.Button active style={{ marginLeft: 10, width: 150 }} />
                  </div>
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full h-auto rounded mt-2"
                    style={{ maxHeight: "200px", objectFit: "cover" }}
                  />
                ) : null}
              </Form.Item>
            </>
          ) : (
            <Form.Item
              name="visionpoint"
              label="Vision Point"
              rules={[{ required: true, message: "Please enter vision point" }]}
            >
              <TextArea rows={4} />
            </Form.Item>
          )}
          <div className="flex justify-end">
            <Button type="primary" htmlType="submit">
              {modalData.type === "addPoint" ? "Add" : "Save"}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default React.memo(AdminVision);
