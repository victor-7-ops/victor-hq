import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: ["MetroCity/**", "reference/**", "artifacts/**", "data/**"],
  },
];
