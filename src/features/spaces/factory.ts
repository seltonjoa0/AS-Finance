type InitialSpaceData = {
  name: string;
  createdById: string;
  members: {
    create: {
      userId: string;
      role: "OWNER";
    };
  };
};

export function buildInitialSpaceData(
  userId: string,
  name: string,
): InitialSpaceData {
  return {
    name,
    createdById: userId,
    members: {
      create: {
        userId,
        role: "OWNER",
      },
    },
  };
}
