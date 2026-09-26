import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemberPicker } from "./MemberPicker.jsx";
import { useMembers, useMember } from "../hooks/useMembers.js";

// useMembers.js talks to Supabase directly — mocked here so MemberPicker's
// own logic (typing never selects, only a click does; dropdown open/close;
// resolving a pre-selected id) is what's under test, not the query layer.
vi.mock("../hooks/useMembers.js", () => ({
  useMembers: vi.fn(),
  useMember: vi.fn(),
}));

const AMA = { id: "11111111-1111-1111-1111-111111111111", name: "Ama Mensah", contact: "0244000001" };
const AMA_2 = { id: "22222222-2222-2222-2222-222222222222", name: "Ama Owusu", contact: "0244000002" };

function getSearchInput() {
  return screen.getByPlaceholderText(/search members/i);
}

describe("MemberPicker", () => {
  beforeEach(() => {
    useMembers.mockReturnValue({ data: { rows: [AMA, AMA_2], total: 2 } });
    useMember.mockReturnValue({ data: undefined });
  });

  it("shows nothing until the user types a search term", () => {
    render(<MemberPicker value="" onSelect={() => {}} />);
    expect(screen.queryByText("Ama Mensah")).not.toBeInTheDocument();
  });

  it("shows matching members in a dropdown as the user types", () => {
    render(<MemberPicker value="" onSelect={() => {}} />);
    fireEvent.change(getSearchInput(), { target: { value: "Ama" } });
    expect(screen.getByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("Ama Owusu")).toBeInTheDocument();
  });

  it('shows "No matches." when nothing matches the search', () => {
    useMembers.mockReturnValue({ data: { rows: [], total: 0 } });
    render(<MemberPicker value="" onSelect={() => {}} />);
    fireEvent.change(getSearchInput(), { target: { value: "Nobody" } });
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });

  it("typing alone never selects a member — onSelect only fires on a click", () => {
    const onSelect = vi.fn();
    render(<MemberPicker value="" onSelect={onSelect} />);
    fireEvent.change(getSearchInput(), { target: { value: "Ama Mensah" } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking a result selects it, passing the full member record (including its uuid)", () => {
    const onSelect = vi.fn();
    render(<MemberPicker value="" onSelect={onSelect} />);
    fireEvent.change(getSearchInput(), { target: { value: "Ama" } });
    fireEvent.click(screen.getByText("Ama Owusu"));
    expect(onSelect).toHaveBeenCalledWith(AMA_2);
  });

  it("displays the selected member's name and contact, with a Change option, once a value is set", () => {
    render(<MemberPicker value={AMA.id} selectedMember={AMA} onSelect={() => {}} onChange={() => {}} />);
    expect(screen.getByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("0244000001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it('"Change" clears the current selection', () => {
    const onChange = vi.fn();
    render(<MemberPicker value={AMA.id} selectedMember={AMA} onSelect={() => {}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(onChange).toHaveBeenCalled();
  });

  it("resolves an existing selection by id alone (editing a record without a pre-joined member)", () => {
    useMember.mockReturnValue({ data: AMA });
    render(<MemberPicker value={AMA.id} onSelect={() => {}} />);
    expect(screen.getByText("Ama Mensah")).toBeInTheDocument();
  });

  it("closes the results dropdown when clicking outside", () => {
    render(
      <div>
        <button type="button">outside</button>
        <MemberPicker value="" onSelect={() => {}} />
      </div>
    );
    fireEvent.change(getSearchInput(), { target: { value: "Ama" } });
    expect(screen.getByText("Ama Mensah")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByText("Ama Mensah")).not.toBeInTheDocument();
  });
});
