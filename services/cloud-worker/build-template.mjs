import {
  Template,
  defaultBuildLogger,
} from "e2b";

const templateName =
  process.env.VACODER_E2B_TEMPLATE ||
  "vacoder-node22";

const template = Template()
  .fromNodeImage("22")
  .aptInstall([
    "tar",
    "git",
    "ca-certificates",
  ])
  .setWorkdir("/home/user")
  .runCmd(
    "node --version && npm --version && tar --version | head -n 1",
  );

console.log(
  `Construyendo E2B template: ${templateName}`,
);

await Template.build(
  template,
  templateName,
  {
    cpuCount: 2,
    memoryMB: 4096,
    onBuildLogs:
      defaultBuildLogger(),
  },
);

console.log(
  `E2B TEMPLATE READY: ${templateName}`,
);
