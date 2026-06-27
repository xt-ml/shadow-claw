try {
  const blob = new Blob(["abc"]);
  const res = new Response(blob);
  console.log("Success", res);
} catch (e) {
  console.log("Error", e);
}
