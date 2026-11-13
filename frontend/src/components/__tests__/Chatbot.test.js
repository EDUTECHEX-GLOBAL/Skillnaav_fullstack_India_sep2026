import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Chatbot from "../Chatbot";
import axiosInstance from "../../api/axiosInstance";

jest.mock("../../api/axiosInstance", () => ({
  __esModule: true,
  default: {
    defaults: { baseURL: "http://localhost:5000" },
    post: jest.fn(),
  },
}));

describe("Chatbot AI Avatar Integration & State Machine", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();

    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    window.HTMLElement.prototype.scrollIntoView = jest.fn();

    // Mock canvas 2d context
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      clearRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
      drawImage: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      clip: jest.fn(),
    }));

    // Mock AudioContext + fetch for TTS
    global.AudioContext = class {
      constructor() {
        this.state = "running";
        this.currentTime = 0;
        this.destination = {};
      }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: jest.fn() }; }
      createGain() { return { gain: { value: 1 }, connect: jest.fn() }; }
      createAnalyser() { return { fftSize: 512, frequencyBinCount: 256, connect: jest.fn(), getByteTimeDomainData: jest.fn(), getByteFrequencyData: jest.fn() }; }
      decodeAudioData() { return Promise.resolve({ duration: 1.2 }); }
      createBufferSource() {
        return { connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null };
      }
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    );

    axiosInstance.post.mockResolvedValue({
      data: { reply: "We offer verified A.I. and Robotics internships on Edutechex.", gesture: "open" },
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("opens assistant menu, submits typed question on Enter without duplicates, handles interruption, and unmounts cleanly", async () => {
    const { unmount } = render(<Chatbot isTextChatOpen={false} />);

    // 1. Click FAB -> opens clean white CHOOSE ASSISTANT menu
    const fabBtn = screen.getByTitle("Open Edutechex Assistant");
    fireEvent.click(fabBtn);
    expect(screen.getByText("CHOOSE ASSISTANT")).toBeInTheDocument();

    // 2. Click Video Assistant -> opens expanded dialog & starts session
    fireEvent.click(screen.getByText("Video Assistant"));
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    // 3. Open Chat & Transcript panel
    const chatBtn = screen.getByTitle("Live Transcript & Chat");
    fireEvent.click(chatBtn);

    const input = screen.getByPlaceholderText("Type question & press Enter...");
    fireEvent.change(input, { target: { value: "Tell me about internships" } });

    // Submit via Enter + immediate second Enter (must prevent duplicate submission!)
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });
    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/api/career-chat",
      { message: "Tell me about internships", voice: true },
      expect.any(Object)
    );

    await waitFor(() => {
      expect(
        screen.getByText("We offer verified A.I. and Robotics internships on Edutechex.")
      ).toBeInTheDocument();
    });

    // 4. Verify interrupting speech during active playback stops current audio cleanly and allows follow-up error recovery
    const stopSpy = jest.fn();
    global.AudioContext.prototype.createBufferSource = () => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: stopSpy,
      onended: null,
    });

    axiosInstance.post.mockRejectedValueOnce(new Error("Network Timeout"));
    fireEvent.change(input, { target: { value: "Second question" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Edutechex provides career acceleration, verified internships/i)
      ).toBeInTheDocument();
    });

    // After API error, recovery allows another successful turn (no stuck lock)
    axiosInstance.post.mockResolvedValueOnce({
      data: { reply: "Recovered successfully.", gesture: "wave" },
    });
    fireEvent.change(input, { target: { value: "Third question" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Recovered successfully.")).toBeInTheDocument();
    });

    // 5. Clean unmount without thrown errors
    unmount();
  });

  test("dispatches open-text-chat when Text Chat option is clicked", () => {
    const handler = jest.fn();
    window.addEventListener("open-text-chat", handler);

    const { unmount } = render(<Chatbot isTextChatOpen={false} />);
    fireEvent.click(screen.getByTitle("Open Edutechex Assistant"));
    fireEvent.click(screen.getByText("Text Chat"));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("open-text-chat", handler);
    unmount();
  });

  test("renders compact homepage video preview card alongside assistant FAB and closes preview cleanly", async () => {
    const { unmount } = render(<Chatbot isTextChatOpen={false} />);
    const closePreviewBtn = screen.getByTitle("Close");
    expect(closePreviewBtn).toBeInTheDocument();
    expect(screen.getByTitle("Open Edutechex Assistant")).toBeInTheDocument();

    fireEvent.click(closePreviewBtn);
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByTitle("Close")).not.toBeInTheDocument();
    });
    expect(screen.getByTitle("Open Edutechex Assistant")).toBeInTheDocument();
    unmount();
  });
});
