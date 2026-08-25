#!/usr/bin/env ruby
# frozen_string_literal: true

require "yaml"
require "json"
require "pathname"
require "date"

ROOT = Pathname.new(__dir__).join("..").expand_path
OUT = ROOT.join("docs", "test-catalog.md")

def words(value)
  value.to_s
    .gsub(/([a-z0-9])([A-Z])/, '\\1 \\2')
    .gsub(/[_-]+/, " ")
    .gsub(/\s+/, " ")
    .strip
end

def sentence(value)
  text = words(value)
  return text if text.empty?
  text = text[0].upcase + text[1..]
  text.end_with?(".") ? text : "#{text}."
end

def yaml_domain(path, action)
  return "Quick add / parsing" if path.include?("/quickadd/")
  "TaskManager-compatible API / #{words(action)}"
end

def compact_value(value)
  case value
  when nil then "null"
  when String then value.empty? ? 'empty string' : "`#{value.gsub('`', '\\`')}`"
  when TrueClass, FalseClass, Numeric then "`#{value}`"
  when Array
    return "empty list" if value.empty?
    value.length <= 4 ? value.map { |v| compact_value(v) }.join(", ") : "#{value.length} items"
  when Hash
    keys = value.keys.map(&:to_s)
    keys.length <= 5 ? "object containing #{keys.map { |k| "`#{k}`" }.join(', ')}" : "object with #{keys.length} fields"
  else "`#{value}`"
  end
end

def yaml_outcome(test)
  expected = test["then"] || {}
  if expected["success"] == false
    code = expected.dig("error", "code")
    return code ? "The request should fail with `#{code}`." : "The request should be rejected."
  end

  parsed = expected["parsed"]
  if parsed
    fields = parsed.map { |key, value| "`#{key}` = #{compact_value(value)}" }
    return "Parsing should succeed with #{fields.join('; ')}."
  end

  payload = expected.reject { |key, _| key == "success" }
  return "The operation should succeed." if payload.empty?
  details = payload.map { |key, value| "`#{key}` as #{compact_value(value)}" }
  "The operation should succeed and return/produce #{details.join('; ')}."
end

def inferred_outcome(name)
  plain = words(name).sub(/^Test\s+/i, "")
  case plain
  when /rejects?|does not allow|prevents?|fails?|invalid|requires?|read only|no[- ]?ops?/i
    "The invalid or unauthorized behavior described by the test should be rejected without an unintended state change."
  when /persists?|keeps?|remains?|across restart|after reload/i
    "The described state should be saved and remain correct after the reload, restart, or subsequent read."
  when /creates?|adds?|spawns?|grants?|credits?/i
    "The requested entity or reward should be created with the asserted attributes and related state updates."
  when /deletes?|removes?|consumes?|clears?/i
    "The targeted state should be removed or consumed, with unrelated state preserved."
  when /updates?|changes?|sets?|normalizes?|parses?|extracts?|resolves?|slugify/i
    "The operation should produce the normalized, parsed, resolved, or updated value asserted by the test."
  when /opens?|closes?|navigates?|shows?|renders?|hides?|toggles?|supports?|captures?|refreshes?|simulates?/i
    "The user-visible interaction should complete and the asserted UI, navigation, request, or state should result."
  else
    "The behavior named by the test should complete with all asserted values and side effects."
  end
end

sections = Hash.new { |hash, key| hash[key] = [] }

Dir.glob(ROOT.join("docs/specs/{quickadd,taskmanager}/*.yaml")).sort.each do |path|
  doc = YAML.safe_load(File.read(path), permitted_classes: [Date, Time], aliases: true)
  Array(doc["tests"]).each do |test|
    action = test.dig("when", "action") || "unspecified action"
    next if path.include?("/taskmanager/") && %w[uploadFile uploadWorkspaceLogo deleteUpload].include?(action.strip)
    id = test["test_id"] || "unnamed"
    description = test["description"] || "#{action} case #{id}"
    rel = Pathname.new(path).relative_path_from(ROOT)
    sections["Executable YAML specification cases"] << "- **#{id}** — Domain: #{yaml_domain(path, action)}. Functionality: #{sentence(description)} Outcome: #{yaml_outcome(test)} Source: [`#{rel}`](../#{rel})."
  end
end

Dir.glob(ROOT.join("**/*_test.go")).sort.each do |path|
  rel = Pathname.new(path).relative_path_from(ROOT)
  source = File.read(path)
  source.scan(/^func (Test\w+)\s*\(/).flatten.each do |name|
    domain = rel.dirname.to_s.sub(%r{^internal/}, "").sub(%r{^cmd/}, "command/").tr("_", " ")
    sections["Go tests"] << "- **#{name}** — Domain: #{domain}. Functionality: #{sentence(name.sub(/^Test/, ''))} Outcome: #{inferred_outcome(name)} Source: [`#{rel}`](../#{rel})."
  end
end

Dir.glob(ROOT.join("web/apps/client/tests/**/*.spec.ts")).sort.each do |path|
  rel = Pathname.new(path).relative_path_from(ROOT)
  source = File.read(path)
  names = source.scan(/\btest\(\s*["']([^"']+)["']/).flatten
  source.scan(/\btest\(\s*`([^`]+)`/).flatten.each { |name| names << name }
  names.each do |name|
    domain = "Web UI / #{rel.basename.to_s.sub(/\.spec\.ts$/, '').tr('.', ' ')}"
    sections["Playwright end-to-end tests"] << "- **#{name}** — Domain: #{domain}. Functionality: #{sentence(name)} Outcome: #{inferred_outcome(name)} Source: [`#{rel}`](../#{rel})."
  end
end

counts = sections.transform_values(&:length)
total = counts.values.sum
header = <<~MARKDOWN
  # Test behavior catalog

  Generated from the repository's executable Go tests, Playwright specifications, and YAML cases loaded by the Go specification runners. Each bullet states the covered domain, functionality, and expected outcome. Descriptive-only files under `docs/scenarios/` and `docs/test-case-board.yaml` are excluded because no test runner executes them. TaskManager upload YAML cases are also excluded because the parity runner explicitly skips upload actions.

  **This catalog is an executable-test inventory, not a feature-support matrix.** A legacy compatibility case may remain here even after that public compatibility action is retired. For the maintained task-manager support contract, use [`docs/audits/task-manager-closeout.md`](audits/task-manager-closeout.md) and [`docs/audits/task-manager-feature-matrix.md`](audits/task-manager-feature-matrix.md).

  Inventory: **#{total} test entries** — #{counts.map { |name, count| "#{count} #{name.downcase}" }.join(', ')}.

  Regenerate with `ruby scripts/generate-test-catalog.rb` after adding or renaming tests.

MARKDOWN

body = sections.map do |title, bullets|
  "## #{title}\n\n#{bullets.join("\n")}\n"
end.join("\n")

OUT.write(header + body)
puts "Wrote #{OUT} with #{total} entries"
