// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApplicationActivity } from "../src/applicationActivity";
import { GraphView } from "../src/components/GraphView";
import type { SiteData } from "../src/types";

const mocks = vi.hoisted(() => ({ simulations: [] as Array<{ stop: ReturnType<typeof vi.fn>; restart: ReturnType<typeof vi.fn> }>, paint: vi.fn(), observe: vi.fn(), disconnect: vi.fn() }));
vi.mock("d3-force", () => {
  const force = () => { const chain: Record<string, unknown> = {}; for (const key of ["id", "distance", "strength", "radius"]) chain[key] = () => chain; return chain; };
  return { forceCollide: force, forceLink: force, forceManyBody: force, forceX: force, forceY: force,
    forceSimulation: () => {
      const simulation = { force: () => simulation, on: () => simulation, alpha: () => .8, alphaMin: () => .001, stop: vi.fn(), restart: vi.fn() };
      mocks.simulations.push(simulation); return simulation;
    } };
});
vi.mock("../src/components/compendiumPresentation", () => ({ useCompendiumText: () => (en: string) => en }));
let root: Root, container: HTMLDivElement;
const navigate = vi.fn();
const site = { entities: [{ id: "a", name: "A", type: "character", route: "/a/", linkedIds: [] }], stories: [] } as unknown as SiteData;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.simulations.length = 0; mocks.paint.mockClear(); mocks.observe.mockClear(); mocks.disconnect.mockClear();
  vi.stubGlobal("ResizeObserver", class { observe = mocks.observe; disconnect = mocks.disconnect; });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ save() {}, restore() {}, scale() {}, fillRect: mocks.paint, translate() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {}, fillText() {}, stroke() {}, moveTo() {}, lineTo() {}, setLineDash() {} } as unknown as CanvasRenderingContext2D);
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const render = async (active: boolean) => act(async () => root.render(<ApplicationActivity.Provider value={active}><GraphView site={site} navigate={navigate} /></ApplicationActivity.Provider>));
it("pauses hidden graph work and resumes the same simulation and canvas", async () => {
  await render(true);
  const simulation = mocks.simulations[0], canvas = container.querySelector("canvas");
  await render(false);
  expect(simulation.stop).toHaveBeenCalled(); expect(mocks.disconnect).toHaveBeenCalled();
  const paints = mocks.paint.mock.calls.length;
  document.documentElement.setAttribute("data-theme", "hidden");
  await act(async () => {});
  expect(mocks.paint.mock.calls.length).toBe(paints);
  await render(true);
  expect(mocks.simulations).toHaveLength(1); expect(container.querySelector("canvas")).toBe(canvas);
  expect(simulation.restart).toHaveBeenCalled(); expect(mocks.paint.mock.calls.length).toBeGreaterThan(paints);
});
it("starts suspended when mounted hidden and keeps standalone graphs active", async () => {
  await render(false); expect(mocks.simulations[0].stop).toHaveBeenCalled(); expect(mocks.paint).not.toHaveBeenCalled();
  await act(async () => root.render(<GraphView site={site} navigate={navigate} />));
  expect(mocks.paint).toHaveBeenCalled();
});
