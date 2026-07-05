import type { ToolDefinition } from "./types.js";

export const create_room: ToolDefinition = {
  name: "create_room",
  description:
    "Create a new multi-party room (a shared PeerJS conversation) hosted by " +
    "this device. Other agents or humans can then be invited to participate. " +
    "Returns the room so you can share or invite peers into it.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "A human-readable name for the room.",
      },
    },
    required: ["name"],
  },
};

export const invite_to_room: ToolDefinition = {
  name: "invite_to_room",
  description:
    "Invite a peer (another agent or human, identified by their PeerJS peer " +
    "ID) into a room so they can join the shared conversation. If room_id is " +
    "omitted and the current conversation is a room, that room is used.",
  input_schema: {
    type: "object",
    properties: {
      peer_id: {
        type: "string",
        description: "The PeerJS peer ID of the participant to invite.",
      },
      room_id: {
        type: "string",
        description:
          "The room id to invite into. Defaults to the current room conversation.",
      },
    },
    required: ["peer_id"],
  },
};

export const leave_room: ToolDefinition = {
  name: "leave_room",
  description:
    "Leave a room. If you are the host, the room is disbanded for all " +
    "members. If room_id is omitted and the current conversation is a room, " +
    "that room is used.",
  input_schema: {
    type: "object",
    properties: {
      room_id: {
        type: "string",
        description:
          "The room id to leave. Defaults to the current room conversation.",
      },
    },
  },
};

export const list_room_members: ToolDefinition = {
  name: "list_room_members",
  description:
    "List the participants (humans and agents) currently in a room. If " +
    "room_id is omitted and the current conversation is a room, that room is " +
    "used.",
  input_schema: {
    type: "object",
    properties: {
      room_id: {
        type: "string",
        description:
          "The room id to inspect. Defaults to the current room conversation.",
      },
    },
  },
};
