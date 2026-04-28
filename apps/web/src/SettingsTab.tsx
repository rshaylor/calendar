import type { FamilyMember } from "./api";
import FamilyTab from "./FamilyTab";
import CalendarSettings from "./CalendarSettings";

type Props = {
  members: FamilyMember[];
  onMembersChanged: () => void;
};

export default function SettingsTab({ members, onMembersChanged }: Props) {
  return (
    <div className="space-y-10 max-w-3xl">
      <section>
        <h2 className="text-xl font-semibold mb-3">Family</h2>
        <FamilyTab members={members} onChanged={onMembersChanged} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Calendar</h2>
        <CalendarSettings members={members} />
      </section>
    </div>
  );
}
