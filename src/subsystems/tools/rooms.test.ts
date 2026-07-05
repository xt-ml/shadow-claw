import {
  create_room,
  invite_to_room,
  leave_room,
  list_room_members,
} from "./rooms.js";

describe("room tool definitions", () => {
  it("defines create_room requiring a name", () => {
    expect(create_room.name).toBe("create_room");
    expect(create_room.input_schema.required).toEqual(["name"]);
    expect(create_room.input_schema.properties).toHaveProperty("name");
  });

  it("defines invite_to_room requiring a peer_id", () => {
    expect(invite_to_room.name).toBe("invite_to_room");
    expect(invite_to_room.input_schema.required).toEqual(["peer_id"]);
    expect(invite_to_room.input_schema.properties).toHaveProperty("peer_id");
    expect(invite_to_room.input_schema.properties).toHaveProperty("room_id");
  });

  it("defines leave_room with an optional room_id", () => {
    expect(leave_room.name).toBe("leave_room");
    expect(leave_room.input_schema.required ?? []).toEqual([]);
    expect(leave_room.input_schema.properties).toHaveProperty("room_id");
  });

  it("defines list_room_members with an optional room_id", () => {
    expect(list_room_members.name).toBe("list_room_members");
    expect(list_room_members.input_schema.required ?? []).toEqual([]);
    expect(list_room_members.input_schema.properties).toHaveProperty("room_id");
  });
});
