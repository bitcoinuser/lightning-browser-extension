import { SendIcon } from "@bitcoin-design/bitcoin-icons-react/filled";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import utils from "../../../../common/lib/utils";

import ConnectorForm from "../../../components/ConnectorForm";
import TextField from "../../../components/form/TextField";
import CompanionDownloadInfo from "../../../components/CompanionDownloadInfo";

const initialFormData = Object.freeze({
  url: "",
  macaroon: "",
});

export default function ConnectLnd() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormData);
  const [isDragging, setDragging] = useState(false);
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value.trim(),
    });
  }

  function getConnectorType() {
    if (formData.url.match(/\.onion/i)) {
      return "nativelnd";
    }
    // default to LND
    return "lnd";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const { url, macaroon } = formData;
    const account = {
      name: "LND",
      config: {
        macaroon,
        url,
      },
      connector: getConnectorType(),
    };

    try {
      let validation;
      // TODO: for native connectors we currently skip the validation because it is too slow (booting up Tor etc.)
      if (account.connector === "nativelnd") {
        validation = { valid: true, error: "" };
      } else {
        validation = await utils.call("validateAccount", account);
      }

      if (validation.valid) {
        const addResult = await utils.call("addAccount", account);
        if (addResult.accountId) {
          await utils.call("selectAccount", {
            id: addResult.accountId,
          });
          navigate("/test-connection");
        }
      } else {
        alert(`
          Connection failed. Are your LND credentials correct? \n\n(${validation.error})`);
      }
    } catch (e) {
      console.error(e);
      let message = "Connection failed. Are your LND credentials correct?";
      if (e instanceof Error) {
        message += `\n\n${e.message}`;
      }
      alert(message);
    }
    setLoading(false);
  }

  function dropHandler(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (
      event.dataTransfer.items &&
      event.dataTransfer.items[0].kind === "file"
    ) {
      const file = event.dataTransfer.items[0].getAsFile();
      if (file) {
        const extension = file.name.split(".").pop();
        if (extension === "macaroon") readFile(file);
      }
    }
    if (isDragging) setDragging(false);
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = function (evt) {
      if (evt.target?.result) {
        const macaroon = utils.bytesToHexString(
          new Uint8Array(evt.target.result as ArrayBuffer)
        );
        if (macaroon) {
          setFormData({
            ...formData,
            macaroon,
          });
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function dragOverHandler(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isDragging) setDragging(true);
  }

  function dragLeaveHandler(event: React.DragEvent<HTMLDivElement>) {
    if (isDragging) setDragging(false);
  }

  return (
    <ConnectorForm
      title="Connect to your LND node"
      description="You need your node URL and a macaroon with read and send permissions (e.g. admin.macaroon)"
      submitLoading={loading}
      submitDisabled={formData.url === "" || formData.macaroon === ""}
      onSubmit={handleSubmit}
    >
      <div className="mb-6">
        <TextField
          id="url"
          label="REST API host and port"
          placeholder="https://your-node-url:8080"
          pattern="https://.+"
          title="https://your-node-url:8080"
          onChange={handleChange}
          required
        />
      </div>
      {formData.url.match(/\.onion/i) && (
        <div className="mb-6">
          <CompanionDownloadInfo />
        </div>
      )}
      <div>
        <div>
          <TextField
            id="macaroon"
            label="Macaroon (HEX format)"
            value={formData.macaroon}
            onChange={handleChange}
            required
          />
        </div>
        <p className="text-center my-4 dark:text-white">OR</p>
        <div
          className={`cursor-pointer flex flex-col items-center dark:bg-gray-800 p-4 py-3 border-dashed border-2 border-gray-300 bg-gray-50 rounded-md text-center transition duration-200 ${
            isDragging ? "border-blue-500 bg-blue-50" : ""
          }`}
          onDrop={dropHandler}
          onDragOver={dragOverHandler}
          onDragLeave={dragLeaveHandler}
          onClick={() => {
            if (hiddenFileInput?.current) hiddenFileInput.current.click();
          }}
        >
          <SendIcon className="mb-3 h-6 w-6 text-blue-500" />
          <p className="dark:text-white">
            Drag and drop your macaroon here or{" "}
            <span className="underline">browse</span>
          </p>
          <input
            ref={hiddenFileInput}
            onChange={(event) => {
              if (event.target.files) {
                const file = event.target.files[0];
                readFile(file);
              }
            }}
            type="file"
            accept=".macaroon"
            hidden
          />
        </div>
      </div>
    </ConnectorForm>
  );
}
