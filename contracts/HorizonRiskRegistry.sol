// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Horizon Risk Registry
/// @notice Stores tamper-evident hashes of Horizon Guard risk reports.
/// @dev The registry never holds tokens, grants approvals, or executes user transactions.
contract HorizonRiskRegistry {
    enum Verdict { Low, Medium, High }

    struct Report {
        address reporter;
        address subject;
        bytes32 reportHash;
        uint8 riskScore;
        Verdict verdict;
        uint64 createdAt;
        string metadataURI;
    }

    mapping(bytes32 reportId => Report report) private reports;

    event RiskReportRegistered(
        bytes32 indexed reportId,
        address indexed reporter,
        address indexed subject,
        bytes32 reportHash,
        uint8 riskScore,
        Verdict verdict,
        string metadataURI
    );

    error InvalidReportHash();
    error InvalidRiskScore();
    error ReportAlreadyExists();
    error ReportNotFound();

    function registerReport(
        address subject,
        bytes32 reportHash,
        uint8 riskScore,
        Verdict verdict,
        string calldata metadataURI
    ) external returns (bytes32 reportId) {
        if (reportHash == bytes32(0)) revert InvalidReportHash();
        if (riskScore > 100) revert InvalidRiskScore();

        reportId = computeReportId(msg.sender, subject, reportHash);
        if (reports[reportId].createdAt != 0) revert ReportAlreadyExists();

        reports[reportId] = Report({
            reporter: msg.sender,
            subject: subject,
            reportHash: reportHash,
            riskScore: riskScore,
            verdict: verdict,
            createdAt: uint64(block.timestamp),
            metadataURI: metadataURI
        });

        emit RiskReportRegistered(
            reportId, msg.sender, subject, reportHash, riskScore, verdict, metadataURI
        );
    }

    function getReport(bytes32 reportId) external view returns (Report memory) {
        Report memory report = reports[reportId];
        if (report.createdAt == 0) revert ReportNotFound();
        return report;
    }

    function reportExists(bytes32 reportId) external view returns (bool) {
        return reports[reportId].createdAt != 0;
    }

    function computeReportId(
        address reporter,
        address subject,
        bytes32 reportHash
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, reporter, subject, reportHash));
    }
}
